import { bucketCheckIns, type DailyVisitorPoint, type DayOfWeekPoint, type HourPoint } from '@/lib/reports/bucketing';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

export type DateRange = { start: Date; end: Date };

export function resolveDateRange(preset: '7d' | '30d' | '90d' | 'month'): DateRange {
  const now = new Date();
  if (preset === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end: now };
}

export type { DailyVisitorPoint, HourPoint, DayOfWeekPoint };
export type TopTrainerRow = { trainerUserId: string; name: string; revenue: number; sessions: number };
export type TopCategoryRow = { categoryId: string | null; name: string; revenue: number };

export type OperationalReport = {
  dailyVisitors: DailyVisitorPoint[];
  busiestHours: HourPoint[];
  busiestDays: DayOfWeekPoint[];
  topTrainers: TopTrainerRow[];
  topCategories: TopCategoryRow[];
  totalVisits: number;
};

/** Salon operasyonu raporları — ziyaretçi trendi, yoğunluk saatleri, en çok satan PT/ürün.
 * `timeZone` verilmezse salonun kendi Organization.timezone alanı okunur (varsayılan Europe/Istanbul). */
export async function getOperationalReport(
  organizationId: string,
  range: DateRange,
  timeZone?: string,
): Promise<OperationalReport> {
  const [checkIns, resolvedTimeZone] = await Promise.all([
    prisma.checkIn.findMany({
      where: {
        organizationId,
        subjectType: 'GYM_MEMBER',
        direction: 'ENTRY',
        checkedInAt: { gte: range.start, lte: range.end },
      },
      select: { checkedInAt: true },
    }),
    timeZone
      ? Promise.resolve(timeZone)
      : prisma.organization
          .findUnique({ where: { id: organizationId }, select: { timezone: true } })
          .then((org) => org?.timezone ?? 'Europe/Istanbul'),
  ]);

  const { dailyVisitors, busiestHours, busiestDays } = bucketCheckIns(
    checkIns.map((c) => c.checkedInAt),
    resolvedTimeZone,
  );

  const [ptSessions, expenses] = await Promise.all([
    prisma.ptSession.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        scheduledAt: { gte: range.start, lte: range.end },
      },
      select: { trainerUserId: true, revenueAmount: true },
    }),
    prisma.expense.findMany({
      where: {
        organizationId,
        status: { not: 'VOID' },
        createdAt: { gte: range.start, lte: range.end },
      },
      select: { categoryId: true, amount: true },
    }),
  ]);

  const trainerTotals = new Map<string, { revenue: number; sessions: number }>();
  for (const session of ptSessions) {
    const current = trainerTotals.get(session.trainerUserId) ?? { revenue: 0, sessions: 0 };
    current.revenue += decimalToNumber(session.revenueAmount);
    current.sessions += 1;
    trainerTotals.set(session.trainerUserId, current);
  }

  const trainerIds = Array.from(trainerTotals.keys());
  const trainerUsers = trainerIds.length
    ? await prisma.user.findMany({ where: { id: { in: trainerIds } }, select: { id: true, name: true } })
    : [];
  const trainerNameById = new Map(trainerUsers.map((u) => [u.id, u.name]));

  const topTrainers: TopTrainerRow[] = Array.from(trainerTotals.entries())
    .map(([trainerUserId, totals]) => ({
      trainerUserId,
      name: trainerNameById.get(trainerUserId) ?? '—',
      revenue: Math.round(totals.revenue * 100) / 100,
      sessions: totals.sessions,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryTotals = new Map<string | null, number>();
  for (const expense of expenses) {
    const key = expense.categoryId;
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + decimalToNumber(expense.amount));
  }

  const categoryIds = Array.from(categoryTotals.keys()).filter((id): id is string => id !== null);
  const categories = categoryIds.length
    ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const topCategories: TopCategoryRow[] = Array.from(categoryTotals.entries())
    .map(([categoryId, revenue]) => ({
      categoryId,
      name: categoryId ? (categoryNameById.get(categoryId) ?? '—') : 'Kategorisiz',
      revenue: Math.round(revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    dailyVisitors,
    busiestHours,
    busiestDays,
    topTrainers,
    topCategories,
    totalVisits: checkIns.length,
  };
}

export type MembershipMetrics = {
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  renewalRate: number | null;
  expiredInPeriod: number;
  mrr: number;
  avgTenureMonths: number;
  ltv: number;
};

/** Üyelik iş metrikleri — MRR, LTV, yenileme/kayıp oranı, ortalama üyelik süresi. */
export async function getMembershipMetrics(
  organizationId: string,
  range: DateRange,
): Promise<MembershipMetrics> {
  const [activeMembers, newMembers, churnedMembers, expiredMembers, activeMembersWithPlans] =
    await Promise.all([
      prisma.gymMember.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.gymMember.count({
        where: { organizationId, createdAt: { gte: range.start, lte: range.end } },
      }),
      prisma.gymMember.count({
        where: { organizationId, status: 'INACTIVE', updatedAt: { gte: range.start, lte: range.end } },
      }),
      prisma.gymMember.findMany({
        where: {
          organizationId,
          membershipEndsAt: { gte: range.start, lte: range.end },
        },
        select: { status: true },
      }),
      prisma.gymMember.findMany({
        where: { organizationId, status: 'ACTIVE' },
        select: { membershipStartsAt: true, plan: { select: { price: true, durationDays: true } } },
      }),
    ]);

  const renewed = expiredMembers.filter((m) => m.status === 'ACTIVE').length;
  const renewalRate = expiredMembers.length > 0 ? Math.round((renewed / expiredMembers.length) * 1000) / 10 : null;

  let mrr = 0;
  let tenureSumMonths = 0;
  let tenureCount = 0;
  const now = Date.now();

  for (const member of activeMembersWithPlans) {
    if (member.plan) {
      const monthlyEquivalent =
        (decimalToNumber(member.plan.price) / Math.max(member.plan.durationDays, 1)) * 30;
      mrr += monthlyEquivalent;
    }
    if (member.membershipStartsAt) {
      const months = (now - member.membershipStartsAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      tenureSumMonths += months;
      tenureCount += 1;
    }
  }

  const avgTenureMonths = tenureCount > 0 ? Math.round((tenureSumMonths / tenureCount) * 10) / 10 : 0;
  const avgMonthlyValue = activeMembersWithPlans.length > 0 ? mrr / activeMembersWithPlans.length : 0;
  const ltv = Math.round(avgMonthlyValue * avgTenureMonths * 100) / 100;

  return {
    activeMembers,
    newMembers,
    churnedMembers,
    renewalRate,
    expiredInPeriod: expiredMembers.length,
    mrr: Math.round(mrr * 100) / 100,
    avgTenureMonths,
    ltv,
  };
}
