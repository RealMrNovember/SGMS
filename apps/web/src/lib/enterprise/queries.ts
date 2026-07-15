import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';
import { resolveDescendantOrganizationIds } from '@/lib/enterprise/hierarchy';
import type { DateRange } from '@/lib/reports/queries';

export type BranchRow = {
  organizationId: string;
  organizationName: string;
  ownerName: string | null;
  activeMembers: number;
  staffCount: number;
  revenue: number;
  checkIns: number;
};

export type ConsolidatedReport = {
  branchCount: number;
  totalActiveMembers: number;
  totalStaff: number;
  totalRevenue: number;
  totalCheckIns: number;
  branches: BranchRow[];
};

/**
 * Bir kurumsal düğümün (şirket/bölge) altındaki TÜM şubeler için konsolide,
 * salt-okunur özet rapor. Faz 28'in tenant-bazlı rapor sorgularıyla aynı mantığı
 * (PAYMENT tipi işlemler = gelir) alt ağaç genelinde toplar.
 */
export async function getConsolidatedReport(
  rootOrganizationId: string,
  range: DateRange,
): Promise<ConsolidatedReport> {
  const organizationIds = await resolveDescendantOrganizationIds(rootOrganizationId);

  const [organizations, activeMemberCounts, staffCounts, payments, checkInCounts, owners] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.gymMember.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: organizationIds }, status: 'ACTIVE' },
      _count: { _all: true },
    }),
    prisma.organizationMember.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: organizationIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        type: 'PAYMENT',
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
    prisma.checkIn.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: organizationIds },
        subjectType: 'GYM_MEMBER',
        direction: 'ENTRY',
        checkedInAt: { gte: range.start, lte: range.end },
      },
      _count: { _all: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: { in: organizationIds }, role: 'OWNER', isActive: true },
      select: { organizationId: true, user: { select: { name: true } } },
    }),
  ]);

  const activeMembersByOrg = new Map(activeMemberCounts.map((r) => [r.organizationId, r._count._all]));
  const staffByOrg = new Map(staffCounts.map((r) => [r.organizationId, r._count._all]));
  const revenueByOrg = new Map(payments.map((r) => [r.organizationId, decimalToNumber(r._sum.amount ?? 0)]));
  const checkInsByOrg = new Map(checkInCounts.map((r) => [r.organizationId, r._count._all]));
  const ownerByOrg = new Map(owners.map((o) => [o.organizationId, o.user.name]));

  const branches: BranchRow[] = organizations.map((org) => ({
    organizationId: org.id,
    organizationName: org.name,
    ownerName: ownerByOrg.get(org.id) ?? null,
    activeMembers: activeMembersByOrg.get(org.id) ?? 0,
    staffCount: staffByOrg.get(org.id) ?? 0,
    revenue: Math.round((revenueByOrg.get(org.id) ?? 0) * 100) / 100,
    checkIns: checkInsByOrg.get(org.id) ?? 0,
  }));

  return {
    branchCount: branches.length,
    totalActiveMembers: branches.reduce((sum, b) => sum + b.activeMembers, 0),
    totalStaff: branches.reduce((sum, b) => sum + b.staffCount, 0),
    totalRevenue: Math.round(branches.reduce((sum, b) => sum + b.revenue, 0) * 100) / 100,
    totalCheckIns: branches.reduce((sum, b) => sum + b.checkIns, 0),
    branches,
  };
}
