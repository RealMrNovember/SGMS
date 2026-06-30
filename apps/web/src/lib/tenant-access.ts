import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import type { CentralLicenseStatus } from '@sgms/database';

const WRITE_ALLOWED_LICENSE: ReadonlySet<CentralLicenseStatus> = new Set([
  'UNKNOWN',
  'TRIAL',
  'ACTIVE',
]);

export async function getTenantWriteBlockReason(
  organizationId: string,
): Promise<string | null> {
  const access = await resolveSubscriptionAccess(organizationId);
  if (access.mode === 'billing_only') {
    return 'Abonelik veya deneme süresi sona erdi. Devam etmek için Abonelik & Ödeme sayfasını kullanın.';
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      status: true,
      centralLicenseStatus: true,
      licenseExpiresAt: true,
    },
  });

  if (!organization) {
    return 'Organizasyon bulunamadı.';
  }

  if (organization.status === 'SUSPENDED') {
    return 'Salon hesabı askıya alındı. Yazma işlemleri devre dışı.';
  }

  if (!WRITE_ALLOWED_LICENSE.has(organization.centralLicenseStatus)) {
    const expires = organization.licenseExpiresAt
      ? organization.licenseExpiresAt.toLocaleDateString('tr-TR')
      : null;
    return expires
      ? `Merkezi lisans süresi doldu (${expires}). Salt okunur moddasınız.`
      : 'Merkezi lisans geçersiz. Salt okunur moddasınız.';
  }

  return null;
}

export async function getActiveSubscriptionPlan(organizationId: string) {
  return prisma.subscription.findFirst({
    where: {
      organizationId,
      status: { in: ['TRIALING', 'ACTIVE'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function assertWithinStaffLimit(organizationId: string): Promise<string | null> {
  const [staffCount, subscription] = await Promise.all([
    prisma.organizationMember.count({
      where: {
        organizationId,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'VIEWER'] },
      },
    }),
    getActiveSubscriptionPlan(organizationId),
  ]);

  const maxStaff = subscription?.plan.maxStaff ?? 0;
  if (staffCount >= maxStaff) {
    return `SaaS plan personel limitine ulaşıldı (maks. ${maxStaff}).`;
  }

  return null;
}

export async function assertWithinMemberLimit(organizationId: string): Promise<string | null> {
  const [memberCount, subscription] = await Promise.all([
    prisma.gymMember.count({
      where: { organizationId, status: { not: 'INACTIVE' } },
    }),
    getActiveSubscriptionPlan(organizationId),
  ]);

  const maxMembers = subscription?.plan.maxMembers ?? 0;
  if (memberCount >= maxMembers) {
    return `SaaS plan üye limitine ulaşıldı (maks. ${maxMembers}).`;
  }

  return null;
}

export async function assertWithinDeviceLimit(organizationId: string): Promise<string | null> {
  const [deviceCount, subscription] = await Promise.all([
    prisma.device.count({
      where: { organizationId, status: { not: 'DISABLED' } },
    }),
    getActiveSubscriptionPlan(organizationId),
  ]);

  const maxDevices = subscription?.plan.maxDevices ?? 0;
  if (deviceCount >= maxDevices) {
    return `SaaS plan cihaz limitine ulaşıldı (maks. ${maxDevices}).`;
  }

  return null;
}
