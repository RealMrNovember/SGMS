import { prisma } from '@/lib/prisma';
import { isPeriodStillValid } from '@/lib/billing/period-dates';
import type { Prisma, SubscriptionStatus } from '@sgms/database';

export type TenantAccessMode = 'full' | 'billing_only';

export type SubscriptionAccessReason =
  | 'trial_active'
  | 'paid_active'
  | 'trial_expired'
  | 'subscription_expired'
  | 'payment_overdue'
  | 'license_expired'
  | 'org_suspended'
  | 'no_subscription';

export type SubscriptionAccessState = {
  mode: TenantAccessMode;
  reason: SubscriptionAccessReason;
  subscriptionStatus: SubscriptionStatus | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  /** Merkezi lisans bitişi — cihaz nezaket penceresi hesabı için. */
  licenseExpiresAt: Date | null;
  daysRemaining: number | null;
  planName: string | null;
  centralLicenseStatus: string;
  organizationStatus: string;
};

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Deneme süresi dolduğunda aboneliği EXPIRED yapar — org/user silinmez. */
export async function syncSubscriptionLifecycle(organizationId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) return;

  const now = new Date();

  if (
    subscription.status === 'TRIALING' &&
    subscription.trialEndsAt &&
    !isPeriodStillValid(subscription.trialEndsAt)
  ) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      }),
      prisma.organization.update({
        where: { id: organizationId },
        data: {
          centralLicenseStatus: 'EXPIRED',
          lastLicenseCheckAt: now,
        },
      }),
    ]);
    return;
  }

  if (
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd &&
    !isPeriodStillValid(subscription.currentPeriodEnd)
  ) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });
  }
}

function subscriptionGrantsAccess(
  subscription: {
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
  } | null | undefined,
): boolean {
  if (!subscription) return false;
  if (subscription.status === 'TRIALING' && isPeriodStillValid(subscription.trialEndsAt)) {
    return true;
  }
  if (subscription.status === 'ACTIVE' && isPeriodStillValid(subscription.currentPeriodEnd)) {
    return true;
  }
  return false;
}

export async function resolveSubscriptionAccess(
  organizationId: string,
): Promise<SubscriptionAccessState> {
  await syncSubscriptionLifecycle(organizationId);

  const [organization, subscription] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        status: true,
        centralLicenseStatus: true,
        licenseExpiresAt: true,
      },
    }),
    prisma.subscription.findFirst({
      where: { organizationId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!organization) {
    return {
      mode: 'billing_only',
      reason: 'no_subscription',
      subscriptionStatus: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      licenseExpiresAt: null,
      daysRemaining: null,
      planName: null,
      centralLicenseStatus: 'UNKNOWN',
      organizationStatus: 'ARCHIVED',
    };
  }

  const base = {
    subscriptionStatus: subscription?.status ?? null,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    licenseExpiresAt: organization.licenseExpiresAt ?? null,
    planName: subscription?.plan.name ?? null,
    centralLicenseStatus: organization.centralLicenseStatus,
    organizationStatus: organization.status,
  };

  if (organization.status === 'SUSPENDED' || organization.status === 'ARCHIVED') {
    return {
      ...base,
      mode: 'billing_only',
      reason: 'org_suspended',
      daysRemaining: daysUntil(subscription?.trialEndsAt ?? organization.licenseExpiresAt),
    };
  }

  if (subscription?.status === 'TRIALING' && subscription.trialEndsAt) {
    const days = daysUntil(subscription.trialEndsAt);
    if (isPeriodStillValid(subscription.trialEndsAt)) {
      return {
        ...base,
        mode: 'full',
        reason: 'trial_active',
        daysRemaining: days,
      };
    }
  }

  if (subscription?.status === 'ACTIVE') {
    const periodEnd = subscription.currentPeriodEnd;
    const days = daysUntil(periodEnd);
    if (!periodEnd || isPeriodStillValid(periodEnd)) {
      return {
        ...base,
        mode: 'full',
        reason: 'paid_active',
        daysRemaining: days,
      };
    }
  }

  if (subscription?.status === 'TRIALING') {
    return {
      ...base,
      mode: 'billing_only',
      reason: 'trial_expired',
      daysRemaining: 0,
    };
  }

  if (subscription?.status === 'EXPIRED' || subscription?.status === 'CANCELED') {
    return {
      ...base,
      mode: 'billing_only',
      reason: 'subscription_expired',
      daysRemaining: 0,
    };
  }

  if (subscription?.status === 'PAST_DUE') {
    return {
      ...base,
      mode: 'billing_only',
      reason: 'payment_overdue',
      daysRemaining: daysUntil(subscription.currentPeriodEnd),
    };
  }

  if (
    organization.centralLicenseStatus === 'EXPIRED' ||
    organization.centralLicenseStatus === 'REVOKED'
  ) {
    // SaaS aboneliği geçerliyse merkezi lisans hatası paneli kilitlemesin (master admin uzatması).
    const subscriptionStillValid = subscriptionGrantsAccess(subscription);

    if (!subscriptionStillValid) {
      return {
        ...base,
        mode: 'billing_only',
        reason: 'license_expired',
        daysRemaining: daysUntil(organization.licenseExpiresAt),
      };
    }

    const reason: SubscriptionAccessReason =
      subscription?.trialEndsAt ? 'trial_active' : 'paid_active';

    return {
      ...base,
      mode: 'full',
      reason,
      daysRemaining: daysUntil(subscription?.trialEndsAt ?? subscription?.currentPeriodEnd ?? null),
    };
  }

  return {
    ...base,
    mode: 'billing_only',
    reason: 'no_subscription',
    daysRemaining: null,
  };
}

export function isBillingPath(pathname: string): boolean {
  return pathname === '/dashboard/billing' || pathname.startsWith('/dashboard/billing/');
}

export const BILLING_ALLOWED_PREFIXES = ['/dashboard/billing'] as const;
