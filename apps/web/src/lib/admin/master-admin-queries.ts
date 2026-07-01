import { prisma } from '@/lib/prisma';

const masterAdminSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  locale: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      memberships: true,
      apiTokens: { where: { revokedAt: null } },
    },
  },
} as const;

export async function listMasterAdmins() {
  return prisma.user.findMany({
    where: { isSuperAdmin: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: masterAdminSelect,
  });
}

export async function getMasterAdminStats() {
  const [total, active, disabled] = await Promise.all([
    prisma.user.count({ where: { isSuperAdmin: true } }),
    prisma.user.count({ where: { isSuperAdmin: true, status: 'ACTIVE' } }),
    prisma.user.count({ where: { isSuperAdmin: true, status: 'DISABLED' } }),
  ]);

  return { total, active, disabled };
}

export async function countActiveMasterAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      isSuperAdmin: true,
      status: 'ACTIVE',
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
