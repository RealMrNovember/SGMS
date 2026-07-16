import type { Prisma } from '@sgms/database';

type SettlePaymentParams = {
  organizationId: string;
  gymMemberId: string;
  amount: number;
  targetExpenseId?: string;
};

/**
 * Bir tahsilatı açık borçlara uygular. Önceki sürüm bir borcu yalnızca tam
 * karşılanabiliyorsa kapatıyordu (kısmi ödeme sessizce atlanıyordu) — burada
 * her borç için gerçek kısmi ödeme (paidAmount birikimli) destekleniyor.
 */
export async function applyPaymentToExpenses(
  tx: Prisma.TransactionClient,
  { organizationId, gymMemberId, amount, targetExpenseId }: SettlePaymentParams,
): Promise<{ remaining: number }> {
  let remaining = amount;

  if (targetExpenseId && remaining > 0) {
    const target = await tx.expense.findFirst({
      where: { id: targetExpenseId, organizationId, gymMemberId, status: 'OPEN' },
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
