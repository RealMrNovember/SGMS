import {
  auditActionLabel,
  auditCategoryForAction,
  auditSummary,
  AUDIT_CATEGORY_ACTIONS,
  type AuditCategory,
} from '@/lib/admin/audit-labels';
import {
  ALL_AUDIT_ACTIONS,
  buildAuditWhere,
  type AuditLogFilters,
} from '@/lib/admin/audit-query';
import { prisma } from '@/lib/prisma';
import type {
  CentralLicenseStatus,
  OrganizationStatus,
  Prisma,
  SubscriptionStatus,
} from '@sgms/database';

export type { AuditLogFilters };
export { ALL_AUDIT_ACTIONS, buildAuditWhere };

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
      partner: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function listActivePlans(currency = 'TRY') {
  return prisma.plan.findMany({
    where: { isActive: true, currency },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function listActivePartners() {
  return prisma.partner.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function listAllPartners() {
  return prisma.partner.findMany({
    include: {
      user: { select: { email: true, lastLoginAt: true } },
      organizations: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
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

const auditInclude = {
  organization: { select: { id: true, name: true, slug: true } },
  actor: { select: { id: true, name: true, email: true, isSuperAdmin: true } },
} satisfies Prisma.AuditLogInclude;

export async function getAuditLogStats(filters: AuditLogFilters = {}) {
  const where = buildAuditWhere(filters);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [total, today, failedLogins, organizations, actionsUsed] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...where, createdAt: { gte: startOfDay } } }),
    prisma.auditLog.count({
      where: {
        ...where,
        action: 'USER_LOGIN_FAILED',
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['organizationId'],
      where: { ...where, organizationId: { not: null } },
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    }),
  ]);

  return {
    total,
    today,
    failedLoginsToday: failedLogins,
    activeOrganizations: organizations.length,
    topActions: actionsUsed
      .map((row) => ({ action: row.action, count: row._count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

export async function listAuditLogsFiltered(
  filters: AuditLogFilters = {},
  page = 1,
  pageSize = 50,
) {
  const where = buildAuditWhere(filters);
  const skip = Math.max(0, (page - 1) * pageSize);
  const take = Math.min(Math.max(pageSize, 1), 200);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: auditInclude,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

export async function listAuditLogsForExport(filters: AuditLogFilters = {}, limit = 10000) {
  return prisma.auditLog.findMany({
    where: buildAuditWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50000),
    include: auditInclude,
  });
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function auditLogsToCsv(
  logs: Awaited<ReturnType<typeof listAuditLogsForExport>>,
): string {
  const header = [
    'id',
    'createdAt',
    'action',
    'actionLabel',
    'category',
    'organization',
    'organizationSlug',
    'actorName',
    'actorEmail',
    'isSuperAdmin',
    'entityType',
    'entityId',
    'ipAddress',
    'userAgent',
    'summary',
    'metadata',
  ];

  const rows = logs.map((log) => {
    const category = auditCategoryForAction(log.action);
    const values = [
      log.id,
      log.createdAt.toISOString(),
      log.action,
      auditActionLabel(log.action),
      category,
      log.organization?.name ?? '',
      log.organization?.slug ?? '',
      log.actor?.name ?? '',
      log.actor?.email ?? '',
      log.actor?.isSuperAdmin ? 'yes' : 'no',
      log.entityType ?? '',
      log.entityId ?? '',
      log.ipAddress ?? '',
      (log.userAgent ?? '').replace(/\s+/g, ' '),
      auditSummary(log.metadata, log.action),
      JSON.stringify(log.metadata ?? {}),
    ];
    return values.map((v) => csvEscape(String(v))).join(',');
  });

  return `\uFEFF${header.join(',')}\n${rows.join('\n')}`;
}

export async function getCategoryCounts(filters: AuditLogFilters = {}) {
  const baseWhere = buildAuditWhere({ ...filters, category: undefined, action: undefined });
  const categories: Exclude<AuditCategory, 'all'>[] = [
    'security',
    'auth',
    'organization',
    'subscription',
    'license',
    'team',
    'members',
    'devices',
    'finance',
    'checkin',
    'settings',
  ];

  const counts = await Promise.all(
    categories.map(async (category) => {
      try {
        const count = await prisma.auditLog.count({
          where: {
            ...baseWhere,
            action: { in: AUDIT_CATEGORY_ACTIONS[category] },
          },
        });
        return { category, count };
      } catch (error) {
        console.error(`[audit] category count failed (${category})`, error);
        return { category, count: 0 };
      }
    }),
  );

  return counts.sort((a, b) => b.count - a.count);
}

export async function listOrganizationAuditLogs(
  organizationId: string,
  take = 50,
  skip = 0,
) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    include: auditInclude,
  });
}

export async function countOrganizationAuditLogs(organizationId: string) {
  return prisma.auditLog.count({ where: { organizationId } });
}

export async function getRecentSecurityAuditLogs(take = 8) {
  return prisma.auditLog.findMany({
    where: {
      action: {
        in: ['USER_LOGIN_FAILED', 'ACCESS_DENIED', 'API_ERROR', 'MESSAGE_REPORTED', 'AUDIT_LOG_DELETED'],
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      actor: { select: { name: true, email: true, isSuperAdmin: true } },
    },
  });
}

export async function getRecentOrganizations(limit = 8) {
  return listOrganizations({}, limit);
}
