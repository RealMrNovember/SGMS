import { prisma } from '@/lib/prisma';
import type {
  CentralLicenseStatus,
  OrganizationStatus,
  Prisma,
  SubscriptionStatus,
} from '@sgms/database';

export type OrganizationListFilters = {
  q?: string;
  status?: OrganizationStatus;
  subscription?: SubscriptionStatus | 'trial' | 'paid';
  license?: CentralLicenseStatus;
};

const orgListInclude = {
  subscriptions: {
    where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED'] as SubscriptionStatus[] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  members: {
    where: { role: 'OWNER' as const, isActive: true },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
    take: 1,
  },
  _count: {
    select: {
      gymMembers: true,
      members: true,
      devices: true,
    },
  },
} satisfies Prisma.OrganizationInclude;

export async function getAdminDashboardStats() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trialWarning = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    organizationCount,
    activeOrgs,
    trialingSubscriptions,
    activeSubscriptions,
    expiringTrials,
    licenseIssues,
    newThisWeek,
    pastDue,
    suspendedOrgs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lte: trialWarning, gte: now },
      },
    }),
    prisma.organization.count({
      where: {
        centralLicenseStatus: { in: ['EXPIRED', 'REVOKED', 'UNKNOWN'] },
      },
    }),
    prisma.organization.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.organization.count({ where: { status: 'SUSPENDED' } }),
  ]);

  return {
    organizationCount,
    activeOrgs,
    trialingSubscriptions,
    activeSubscriptions,
    expiringTrials,
    licenseIssues,
    newThisWeek,
    pastDue,
    suspendedOrgs,
  };
}

function buildOrganizationWhere(filters: OrganizationListFilters): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.license) {
    where.centralLicenseStatus = filters.license;
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      {
        members: {
          some: {
            role: 'OWNER',
            user: { email: { contains: q, mode: 'insensitive' } },
          },
        },
      },
    ];
  }

  if (filters.subscription === 'trial') {
    where.subscriptions = { some: { status: 'TRIALING' } };
  } else if (filters.subscription === 'paid') {
    where.subscriptions = { some: { status: 'ACTIVE' } };
  } else if (filters.subscription) {
    where.subscriptions = { some: { status: filters.subscription } };
  }

  return where;
}

export async function listOrganizations(filters: OrganizationListFilters = {}, take = 50) {
  return prisma.organization.findMany({
    where: buildOrganizationWhere(filters),
    orderBy: { createdAt: 'desc' },
    take,
    include: orgListInclude,
  });
}

export async function countOrganizations(filters: OrganizationListFilters = {}) {
  return prisma.organization.count({ where: buildOrganizationWhere(filters) });
}

export async function getOrganizationAdminDetail(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
      _count: {
        select: {
          gymMembers: true,
          members: true,
          devices: true,
          directMessages: true,
          expenseCategories: true,
        },
      },
    },
  });
}

export async function listActivePlans(currency = 'TRY') {
  return prisma.plan.findMany({
    where: { isActive: true, currency },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function listPlatformAuditLogs(take = 40) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      organization: { select: { name: true, slug: true } },
      actor: { select: { name: true, email: true, isSuperAdmin: true } },
    },
  });
}

export async function getRecentOrganizations(limit = 8) {
  return listOrganizations({}, limit);
}
