import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export type DashboardKpis = {
  checkInsToday: number;
  revenueThisMonth: number;
  membershipsExpiringSoonCount: number;
};

/** Ana dashboard için operasyonel özet — "hesap ayarları" değil, günlük çalışan bir salon komuta merkezi. */
export async function getDashboardKpis(organizationId: string, now = new Date()): Promise<DashboardKpis> {
  const today = dayBounds(now);
  const month = monthBounds(now);
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [checkInsToday, revenueAgg, membershipsExpiringSoonCount] = await Promise.all([
    prisma.checkIn.count({
      where: {
        organizationId,
        subjectType: 'GYM_MEMBER',
        direction: 'ENTRY',
        checkedInAt: { gte: today.start, lt: today.end },
      },
    }),
    prisma.transaction.aggregate({
      where: {
        organizationId,
        type: 'PAYMENT',
        createdAt: { gte: month.start, lt: month.end },
      },
      _sum: { amount: true },
    }),
    prisma.gymMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        membershipEndsAt: { gte: now, lte: soon },
      },
    }),
  ]);

  return {
    checkInsToday,
    revenueThisMonth: decimalToNumber(revenueAgg._sum.amount),
    membershipsExpiringSoonCount,
  };
}
