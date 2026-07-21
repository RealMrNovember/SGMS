import { issueInvoiceFromPayment } from '@/actions/invoices';
import { applyPaymentToExpenses, applyPaymentToSpecificExpenses } from '@/lib/billing/settle-payment';
import { decimalToNumber } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';

/**
 * iyzico/PayTR webhook'ları bu ortak yolu çağırır. Atomik "claim" (updateMany +
 * status: pending→processing) ile aynı bildirimin iki kez işlenmesi engellenir
 * (Faz 36.7 desenini izler — bkz. gatewayCheckoutSession'daki eşleniği).
 *
 * Başarılı ödeme: Transaction (CARD) oluşturulur, borç kapatılır
 * (`applyPaymentToExpenses` — `expenseId` varsa önce O hedeflenir, `recordPayment`
 * server action'ıyla aynı fonksiyon), fatura kesilir. `issuedById`/`actorId`
 * olarak üyenin kendi bağlı `User.id`'si kullanılır — webhook'ta işlem yapan
 * bir personel oturumu yoktur.
 *
 * Faz 8.7.1 — `renewalPlanId` doluysa (üyelik yenileme checkout'u), ödeme
 * onaylandıktan SONRA `GymMember.planId`/`membershipEndsAt` de güncellenir.
 * Bilinçli sıralama: tarih uzatma ödeme başarısından ÖNCE değil SONRA olur —
 * aksi halde yarıda bırakılan bir online ödeme üyeliği bedavaya uzatırdı.
 */
export async function settleTenantCheckoutSession(
  checkoutSessionId: string,
  paymentSuccessful: boolean,
): Promise<void> {
  const claim = await prisma.tenantCheckoutSession.updateMany({
    where: { id: checkoutSessionId, status: 'pending' },
    data: { status: 'processing' },
  });

  if (claim.count === 0) {
    return;
  }

  const checkoutSession = await prisma.tenantCheckoutSession.findUnique({
    where: { id: checkoutSessionId },
  });

  if (!checkoutSession) {
    return;
  }

  if (!paymentSuccessful) {
    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'failed' },
    });
    return;
  }

  const member = await prisma.gymMember.findUnique({
    where: { id: checkoutSession.gymMemberId },
    select: { userId: true },
  });

  if (!member?.userId) {
    // Beklenmedik durum: /athlete'e erişebilen her üyenin bağlı bir User'ı olmalı.
    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'failed' },
    });
    return;
  }

  const amount = decimalToNumber(checkoutSession.amount);

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount: checkoutSession.amount,
          currency: checkoutSession.currency,
          type: 'PAYMENT',
          paymentMethod: 'CARD',
          gatewayId: checkoutSession.gatewayId,
          notes: 'Sporcu portalı — kartla ödeme (online)',
          createdById: member.userId!,
        },
      });

      if (checkoutSession.storeExpenseIds.length > 0) {
        // Faz 40 — mağaza sepeti: yalnızca bu checkout'un açtığı Expense
        // satırlarını kapat, sporcunun ilgisiz başka açık borcuna dokunma.
        await applyPaymentToSpecificExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount,
          currency: checkoutSession.currency,
          expenseIds: checkoutSession.storeExpenseIds,
        });
      } else {
        await applyPaymentToExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount,
          currency: checkoutSession.currency,
          targetExpenseId: checkoutSession.expenseId ?? undefined,
        });
      }

      const invoice = await issueInvoiceFromPayment(
        {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount,
          currency: checkoutSession.currency,
          issuedById: member.userId!,
          description:
            checkoutSession.storeExpenseIds.length > 0 ? 'Mağaza siparişi (online)' : 'Kartla ödeme (online)',
        },
        tx,
      );

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { invoiceId: invoice.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: member.userId!,
          organizationId: checkoutSession.organizationId,
          action: 'PAYMENT_RECORDED',
          entityType: 'transaction',
          entityId: transaction.id,
          metadata: {
            gymMemberId: checkoutSession.gymMemberId,
            amount,
            currency: checkoutSession.currency,
            source: checkoutSession.storeExpenseIds.length > 0 ? 'tenant_store_checkout' : 'tenant_card_checkout',
            provider: checkoutSession.provider,
            checkoutSessionId,
            ...(checkoutSession.storeExpenseIds.length > 0
              ? { storeExpenseIds: checkoutSession.storeExpenseIds }
              : {}),
          },
        },
      });

      if (checkoutSession.renewalPlanId && checkoutSession.renewalMembershipEndsAt) {
        await tx.gymMember.update({
          where: { id: checkoutSession.gymMemberId },
          data: {
            planId: checkoutSession.renewalPlanId,
            status: 'ACTIVE',
            ...(checkoutSession.renewalMembershipStartsAt
              ? { membershipStartsAt: checkoutSession.renewalMembershipStartsAt }
              : {}),
            membershipEndsAt: checkoutSession.renewalMembershipEndsAt,
            lastReminderSentAt: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: member.userId!,
            organizationId: checkoutSession.organizationId,
            action: 'MEMBER_UPDATED',
            entityType: 'gym_member',
            entityId: checkoutSession.gymMemberId,
            metadata: {
              kind: 'membership_renewed',
              planId: checkoutSession.renewalPlanId,
              newEndsAt: checkoutSession.renewalMembershipEndsAt.toISOString(),
              amount,
              currency: checkoutSession.currency,
              source: 'athlete_self_service_card',
              checkoutSessionId,
            },
          },
        });
      }
    });

    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'completed' },
    });
  } catch {
    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'failed' },
    });
  }
}
