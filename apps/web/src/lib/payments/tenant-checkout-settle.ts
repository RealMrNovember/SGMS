import { issueInvoiceFromPayment } from '@/actions/invoices';
import { applyPaymentToExpenses, applyPaymentToSpecificExpenses } from '@/lib/billing/settle-payment';
import { decimalToNumber } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';
import { createCategorySaleExpense } from '@/lib/store/category-sale';
import type { Prisma } from '@sgms/database';

type StoreCartLine = { categoryId: string; quantity: number };

function parseStoreCart(value: unknown): StoreCartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const lines: StoreCartLine[] = [];
  for (const row of value) {
    if (
      row &&
      typeof row === 'object' &&
      typeof (row as StoreCartLine).categoryId === 'string' &&
      Number.isInteger((row as StoreCartLine).quantity) &&
      (row as StoreCartLine).quantity >= 1
    ) {
      lines.push({
        categoryId: (row as StoreCartLine).categoryId,
        quantity: (row as StoreCartLine).quantity,
      });
    }
  }
  return lines;
}

/** Terk edilmiş / başarısız mağaza checkout'unda erken açılmış OPEN borçları geri al. */
async function rollbackStoreExpenses(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; expenseIds: string[] },
): Promise<void> {
  if (params.expenseIds.length === 0) {
    return;
  }

  const expenses = await tx.expense.findMany({
    where: {
      id: { in: params.expenseIds },
      organizationId: params.organizationId,
      status: 'OPEN',
    },
    select: { id: true, categoryId: true, description: true },
  });

  for (const expense of expenses) {
    if (expense.categoryId) {
      // description "Name xN" veya "Name" — adetten stoğu geri ekle
      const match = /x(\d+)\s*$/i.exec(expense.description ?? '');
      const quantity = match ? Number.parseInt(match[1], 10) : 1;
      if (Number.isFinite(quantity) && quantity > 0) {
        await tx.expenseCategory.updateMany({
          where: {
            id: expense.categoryId,
            organizationId: params.organizationId,
            stockQuantity: { not: null },
          },
          data: { stockQuantity: { increment: quantity } },
        });
      }
    }
    await tx.expense.update({
      where: { id: expense.id },
      data: { status: 'VOID' },
    });
  }
}

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
 *
 * Faz 40 (2026-07-22) — mağaza sepeti `storeCartJson` ile gelir; stok/borç
 * yalnızca burada, ödeme başarılıysa oluşturulur. Eski in-flight oturumlar
 * `storeExpenseIds` ile gelir; başarısız olursa VOID + stok geri alınır.
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
    if (checkoutSession.storeExpenseIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await rollbackStoreExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          expenseIds: checkoutSession.storeExpenseIds,
        });
      });
    }
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
    if (checkoutSession.storeExpenseIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await rollbackStoreExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          expenseIds: checkoutSession.storeExpenseIds,
        });
      });
    }
    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'failed' },
    });
    return;
  }

  const amount = decimalToNumber(checkoutSession.amount);
  const cartLines = parseStoreCart(checkoutSession.storeCartJson);

  try {
    await prisma.$transaction(async (tx) => {
      let storeExpenseIds = [...checkoutSession.storeExpenseIds];

      // Yeni akış: sepet snapshot'ından stok + OPEN borç ancak şimdi oluşur.
      if (storeExpenseIds.length === 0 && cartLines.length > 0) {
        const categoryIds = [...new Set(cartLines.map((l) => l.categoryId))];
        const categories = await tx.expenseCategory.findMany({
          where: {
            id: { in: categoryIds },
            organizationId: checkoutSession.organizationId,
            isActive: true,
            isStoreVisible: true,
          },
        });
        if (categories.length !== categoryIds.length) {
          throw new Error('Sepetteki ürünlerden biri artık mağazada mevcut değil.');
        }

        const createdIds: string[] = [];
        for (const line of cartLines) {
          const category = categories.find((c) => c.id === line.categoryId);
          if (!category) {
            throw new Error('Sepetteki ürünlerden biri artık mağazada mevcut değil.');
          }
          const created = await createCategorySaleExpense(tx, {
            organizationId: checkoutSession.organizationId,
            gymMemberId: checkoutSession.gymMemberId,
            category,
            createdById: member.userId!,
            quantity: line.quantity,
            channel: 'self_service',
          });
          createdIds.push(created.id);
        }
        storeExpenseIds = createdIds;
        await tx.tenantCheckoutSession.update({
          where: { id: checkoutSessionId },
          data: { storeExpenseIds },
        });
      }

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

      if (storeExpenseIds.length > 0) {
        await applyPaymentToSpecificExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          gymMemberId: checkoutSession.gymMemberId,
          amount,
          currency: checkoutSession.currency,
          expenseIds: storeExpenseIds,
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
          description: storeExpenseIds.length > 0 ? 'Mağaza siparişi (online)' : 'Kartla ödeme (online)',
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
            source: storeExpenseIds.length > 0 ? 'tenant_store_checkout' : 'tenant_card_checkout',
            provider: checkoutSession.provider,
            checkoutSessionId,
            ...(storeExpenseIds.length > 0 ? { storeExpenseIds } : {}),
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
    if (checkoutSession.storeExpenseIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await rollbackStoreExpenses(tx, {
          organizationId: checkoutSession.organizationId,
          expenseIds: checkoutSession.storeExpenseIds,
        });
      }).catch(() => undefined);
    }
    await prisma.tenantCheckoutSession.update({
      where: { id: checkoutSessionId },
      data: { status: 'failed' },
    });
  }
}
