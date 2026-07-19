import { issueInvoiceFromPayment } from '@/actions/invoices';
import { applyPaymentToExpenses } from '@/lib/billing/settle-payment';
import { decimalToNumber } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';

/**
 * iyzico/PayTR webhook'ları bu ortak yolu çağırır. Atomik "claim" (updateMany +
 * status: pending→processing) ile aynı bildirimin iki kez işlenmesi engellenir
 * (Faz 36.7 desenini izler — bkz. gatewayCheckoutSession'daki eşleniği).
 *
 * Başarılı ödeme: Transaction (CARD) oluşturulur, açık borçlara FIFO uygulanır
 * (`applyPaymentToExpenses`, `recordPayment` server action'ıyla aynı fonksiyon),
 * fatura kesilir. `issuedById`/`actorId` olarak üyenin kendi bağlı `User.id`'si
 * kullanılır — webhook'ta işlem yapan bir personel oturumu yoktur.
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

      await applyPaymentToExpenses(tx, {
        organizationId: checkoutSession.organizationId,
        gymMemberId: checkoutSession.gymMemberId,
        amount,
        currency: checkoutSession.currency,
      });

      const invoice = await issueInvoiceFromPayment(
        {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount,
          currency: checkoutSession.currency,
          issuedById: member.userId!,
          description: 'Kartla ödeme (online)',
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
            source: 'tenant_card_checkout',
            provider: checkoutSession.provider,
            checkoutSessionId,
          },
        },
      });
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
