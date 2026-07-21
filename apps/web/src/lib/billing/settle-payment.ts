import type { Prisma } from '@sgms/database';

type SettlePaymentParams = {
  organizationId: string;
  gymMemberId: string;
  amount: number;
  /** Yalnızca bu para birimindeki açık borçlara uygulanır (36.2). */
  currency: string;
  targetExpenseId?: string;
};

/**
 * Bir tahsilatı açık borçlara uygular — yalnızca aynı `currency` içindeki
 * OPEN borçlar (USD ödemesi TRY borcuna düşmez).
 */
export async function applyPaymentToExpenses(
  tx: Prisma.TransactionClient,
  { organizationId, gymMemberId, amount, currency, targetExpenseId }: SettlePaymentParams,
): Promise<{ remaining: number }> {
  const normalizedCurrency = currency.toUpperCase();
  let remaining = amount;

  if (targetExpenseId && remaining > 0) {
    const target = await tx.expense.findFirst({
      where: {
        id: targetExpenseId,
        organizationId,
        gymMemberId,
        status: 'OPEN',
        currency: normalizedCurrency,
      },
    });

    if (target) {
      const targetAmount = Number(target.amount.toString());
      const targetPaid = Number(target.paidAmount.toString());
      const outstanding = targetAmount - targetPaid;
      const pay = Math.min(remaining, outstanding);

      if (pay > 0) {
        const newPaidAmount = targetPaid + pay;
        await tx.expense.update({
          where: { id: target.id },
          data: {
            paidAmount: newPaidAmount,
            ...(newPaidAmount >= targetAmount ? { status: 'PAID', paidAt: new Date() } : {}),
          },
        });
        remaining -= pay;
      }
    }
  }

  if (remaining <= 0) {
    return { remaining };
  }

  const openExpenses = await tx.expense.findMany({
    where: {
      organizationId,
      gymMemberId,
      status: 'OPEN',
      currency: normalizedCurrency,
      ...(targetExpenseId ? { id: { not: targetExpenseId } } : {}),
    },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });

  for (const expense of openExpenses) {
    if (remaining <= 0) {
      break;
    }

    const expenseAmount = Number(expense.amount.toString());
    const expensePaid = Number(expense.paidAmount.toString());
    const outstanding = expenseAmount - expensePaid;
    if (outstanding <= 0) {
      continue;
    }

    const pay = Math.min(remaining, outstanding);
    const newPaidAmount = expensePaid + pay;

    await tx.expense.update({
      where: { id: expense.id },
      data: {
        paidAmount: newPaidAmount,
        ...(newPaidAmount >= expenseAmount ? { status: 'PAID', paidAt: new Date() } : {}),
      },
    });

    remaining -= pay;
  }

  return { remaining };
}

/**
 * Faz 40 — mobil mağaza checkout'u FIFO borç kapama akışına (`applyPaymentToExpenses`)
 * karışmaz: sepetteki ürünler için önceden açılmış TAM OLARAK `expenseIds`
 * kümesini kapatır. Sporcunun ilgisiz başka bir açık borcu (örn. üyelik aidatı)
 * bu ödemeyle yanlışlıkla kapanmaz.
 */
export async function applyPaymentToSpecificExpenses(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; gymMemberId: string; amount: number; currency: string; expenseIds: string[] },
): Promise<{ remaining: number }> {
  const { organizationId, gymMemberId, amount, currency, expenseIds } = params;
  const normalizedCurrency = currency.toUpperCase();
  let remaining = amount;

  if (expenseIds.length === 0) {
    return { remaining };
  }

  const targets = await tx.expense.findMany({
    where: {
      id: { in: expenseIds },
      organizationId,
      gymMemberId,
      status: 'OPEN',
      currency: normalizedCurrency,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const expense of targets) {
    if (remaining <= 0) break;

    const expenseAmount = Number(expense.amount.toString());
    const expensePaid = Number(expense.paidAmount.toString());
    const outstanding = expenseAmount - expensePaid;
    if (outstanding <= 0) continue;

    const pay = Math.min(remaining, outstanding);
    const newPaidAmount = expensePaid + pay;

    await tx.expense.update({
      where: { id: expense.id },
      data: {
        paidAmount: newPaidAmount,
        ...(newPaidAmount >= expenseAmount ? { status: 'PAID', paidAt: new Date() } : {}),
      },
    });

    remaining -= pay;
  }

  return { remaining };
}

type RefundExpenseParams = {
  organizationId: string;
  gymMemberId: string;
  amount: number;
  currency: string;
  expenseId?: string | null;
};

/**
 * İade tutarını borçlara geri yazar: paidAmount düşer, PAID ise yeniden OPEN olur.
 */
export async function applyRefundToExpenses(
  tx: Prisma.TransactionClient,
  { organizationId, gymMemberId, amount, currency, expenseId }: RefundExpenseParams,
): Promise<{ remaining: number }> {
  const normalizedCurrency = currency.toUpperCase();
  let remaining = amount;

  if (expenseId && remaining > 0) {
    const target = await tx.expense.findFirst({
      where: {
        id: expenseId,
        organizationId,
        gymMemberId,
        currency: normalizedCurrency,
        status: { in: ['OPEN', 'PAID'] },
      },
    });

    if (target) {
      const paid = Number(target.paidAmount.toString());
      const take = Math.min(remaining, paid);
      if (take > 0) {
        const newPaid = paid - take;
        await tx.expense.update({
          where: { id: target.id },
          data: {
            paidAmount: newPaid,
            status: 'OPEN',
            paidAt: null,
            voidedAt: null,
          },
        });
        remaining -= take;
      }
    }
  }

  if (remaining <= 0) {
    return { remaining };
  }

  // Orijinal expense yoksa veya yetersizse: aynı para biriminde en son ödenenlerden geri al
  const candidates = await tx.expense.findMany({
    where: {
      organizationId,
      gymMemberId,
      currency: normalizedCurrency,
      status: { in: ['OPEN', 'PAID'] },
      paidAmount: { gt: 0 },
      ...(expenseId ? { id: { not: expenseId } } : {}),
    },
    orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
  });

  for (const expense of candidates) {
    if (remaining <= 0) break;
    const paid = Number(expense.paidAmount.toString());
    const take = Math.min(remaining, paid);
    if (take <= 0) continue;

    const newPaid = paid - take;
    await tx.expense.update({
      where: { id: expense.id },
      data: {
        paidAmount: newPaid,
        status: 'OPEN',
        paidAt: null,
      },
    });
    remaining -= take;
  }

  return { remaining };
}
