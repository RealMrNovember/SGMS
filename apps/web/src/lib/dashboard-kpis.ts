import { prisma } from '@/lib/prisma';
import { getRevenueForPeriod } from '@/lib/reports/revenue';

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
  /** Net tahsilat (PAYMENT − REFUND) — birleşik ciro motoru (36.10). */
  revenueThisMonth: number;
  billedThisMonth: number;
  membershipsExpiringSoonCount: number;
  overdueInstallmentCount: number;
};

/** Ana dashboard için operasyonel özet — "hesap ayarları" değil, günlük çalışan bir salon komuta merkezi. */
export async function getDashboardKpis(organizationId: string, now = new Date()): Promise<DashboardKpis> {
  const today = dayBounds(now);
  const month = monthBounds(now);
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [checkInsToday, revenue, membershipsExpiringSoonCount, overdueInstallmentCount] =
    await Promise.all([
      prisma.checkIn.count({
        where: {
          organizationId,
          subjectType: 'GYM_MEMBER',
          direction: 'ENTRY',
          checkedInAt: { gte: today.start, lt: today.end },
        },
      }),
      getRevenueForPeriod(organizationId, {
        start: month.start,
        end: new Date(month.end.getTime() - 1),
      }),
      prisma.gymMember.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          membershipEndsAt: { gte: now, lte: soon },
        },
      }),
      prisma.expense.count({
        where: {
          organizationId,
          status: 'OPEN',
          paymentPlanId: { not: null },
          dueDate: { lt: now },
        },
      }),
    ]);

  // Tüm para birimlerinin net tahsilat toplamı (dashboard tek rakam gösteriyor; TRY ağırlıklı)
  const collectedAll = revenue.byCurrency.reduce((sum, c) => sum + c.collected, 0);
  const billedAll = revenue.byCurrency.reduce((sum, c) => sum + c.billed, 0);

  return {
    checkInsToday,
    revenueThisMonth: collectedAll,
    billedThisMonth: billedAll,
    membershipsExpiringSoonCount,
    overdueInstallmentCount,
  };
}
