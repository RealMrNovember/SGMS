import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getDailyPosSummary(organizationId: string, date = new Date()) {
  const { start, end } = dayBounds(date);

  const [chargeAgg, paymentAgg, paymentsByMethod, openChargesAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
        status: { in: ['OPEN', 'PAID'] },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        organizationId,
        type: 'PAYMENT',
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where: {
        organizationId,
        type: 'PAYMENT',
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { organizationId, status: 'OPEN' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    date: start.toISOString(),
    chargesTotal: decimalToNumber(chargeAgg._sum.amount),
    chargesCount: chargeAgg._count,
    paymentsTotal: decimalToNumber(paymentAgg._sum.amount),
    paymentsCount: paymentAgg._count,
    openBalanceTotal: decimalToNumber(openChargesAgg._sum.amount),
    openChargesCount: openChargesAgg._count,
    paymentsByMethod: paymentsByMethod.map((row) => ({
      method: row.paymentMethod ?? 'UNKNOWN',
      total: decimalToNumber(row._sum.amount),
      count: row._count,
    })),
  };
}
