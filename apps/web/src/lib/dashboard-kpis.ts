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
  /** Stok eşiğinin altındaki POS kalemleri (17.6). */
  lowStockCount: number;
};

/** Ana dashboard için operasyonel özet — "hesap ayarları" değil, günlük çalışan bir salon komuta merkezi. */
export async function getDashboardKpis(organizationId: string, now = new Date()): Promise<DashboardKpis> {
  const today = dayBounds(now);
  const month = monthBounds(now);
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [checkInsToday, revenue, membershipsExpiringSoonCount, overdueInstallmentCount, lowStockCategories] =
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
      prisma.expenseCategory.findMany({
        where: {
          organizationId,
          isActive: true,
          stockQuantity: { not: null },
        },
        select: { stockQuantity: true, lowStockThreshold: true },
      }),
    ]);

  const lowStockCount = lowStockCategories.filter((c) => {
    const qty = c.stockQuantity ?? 0;
    const threshold = c.lowStockThreshold ?? 5;
    return qty <= threshold;
  }).length;

  // Birincil para birimi (TRY tercih) — farklı para birimlerini toplamak yanıltıcıdır.
  return {
    checkInsToday,
    revenueThisMonth: revenue.collected,
    billedThisMonth: revenue.billed,
    membershipsExpiringSoonCount,
    overdueInstallmentCount,
    lowStockCount,
  };
}
