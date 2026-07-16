import { prisma } from '@/lib/prisma';

export async function getMemberOpenBalance(organizationId: string, gymMemberId: string) {
  const aggregate = await prisma.expense.aggregate({
    where: {
      organizationId,
      gymMemberId,
      status: 'OPEN',
    },
    _sum: { amount: true, paidAmount: true },
  });

  return decimalToNumber(aggregate._sum.amount) - decimalToNumber(aggregate._sum.paidAmount);
}

export async function getMemberAccountSummary(organizationId: string, gymMemberId: string) {
  const [openBalance, recentExpenses, recentTransactions] = await Promise.all([
    getMemberOpenBalance(organizationId, gymMemberId),
    prisma.expense.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { openBalance, recentExpenses, recentTransactions };
}

export function decimalToNumber(value: { toString: () => string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }
  return typeof value === 'number' ? value : Number(value.toString());
}
