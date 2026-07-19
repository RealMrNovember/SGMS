import type { SubscriptionAccessState } from '@/lib/billing/subscription-gate';

/** Panel kilitlendikten sonra turnikenin çalışmaya devam ettiği nezaket süresi (gün). */
export function getDeviceCheckInGraceDays(): number {
  const raw = Number(process.env.DEVICE_CHECKIN_GRACE_DAYS ?? '5');
  if (!Number.isFinite(raw) || raw < 0) return 5;
  return Math.min(30, Math.floor(raw));
}

export type DeviceCheckInPhase = 'full' | 'grace' | 'blocked';

export type DeviceCheckInAccess = {
  allowed: boolean;
  phase: DeviceCheckInPhase;
  graceDaysTotal: number;
  /** Nezaket içinde kalan tam gün (ceil); blocked/full için null. */
  graceDaysRemaining: number | null;
  graceEndsAt: Date | null;
  /** Panelin kilitlendiği an (abonelik/deneme bitişi). */
  lockedAt: Date | null;
  blockReason: 'none' | 'grace_exhausted' | 'org_suspended' | 'no_subscription';
};

/**
 * Panel `billing_only` olsa bile turnike kısa bir nezaket penceresinde açık kalır.
 * Askıya alma / abonelik kaydı yok → anında kapalı (nezaket yok).
 */
export function resolveDeviceCheckInAccess(
  access: SubscriptionAccessState,
  options?: { now?: Date; graceDays?: number },
): DeviceCheckInAccess {
  const now = options?.now ?? new Date();
  const graceDaysTotal = options?.graceDays ?? getDeviceCheckInGraceDays();

  if (access.mode === 'full') {
    return {
      allowed: true,
      phase: 'full',
      graceDaysTotal,
      graceDaysRemaining: null,
      graceEndsAt: null,
      lockedAt: null,
      blockReason: 'none',
    };
  }

  if (access.reason === 'org_suspended') {
    return {
      allowed: false,
      phase: 'blocked',
      graceDaysTotal,
      graceDaysRemaining: null,
      graceEndsAt: null,
      lockedAt: null,
      blockReason: 'org_suspended',
    };
  }

  if (access.reason === 'no_subscription') {
    return {
      allowed: false,
      phase: 'blocked',
      graceDaysTotal,
      graceDaysRemaining: null,
      graceEndsAt: null,
      lockedAt: null,
      blockReason: 'no_subscription',
    };
  }

  const lockedAt = resolveLockAnchor(access);
  if (!lockedAt) {
    // Anchor yoksa güvenli tarafta kal: nezaket yok, kapalı.
    return {
      allowed: false,
      phase: 'blocked',
      graceDaysTotal,
      graceDaysRemaining: null,
      graceEndsAt: null,
      lockedAt: null,
      blockReason: 'grace_exhausted',
    };
  }

  const graceEndsAt = new Date(lockedAt.getTime() + graceDaysTotal * 24 * 60 * 60 * 1000);
  if (now.getTime() < graceEndsAt.getTime()) {
    const graceDaysRemaining = Math.max(
      0,
      Math.ceil((graceEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return {
      allowed: true,
      phase: 'grace',
      graceDaysTotal,
      graceDaysRemaining,
      graceEndsAt,
      lockedAt,
      blockReason: 'none',
    };
  }

  return {
    allowed: false,
    phase: 'blocked',
    graceDaysTotal,
    graceDaysRemaining: 0,
    graceEndsAt,
    lockedAt,
    blockReason: 'grace_exhausted',
  };
}

function resolveLockAnchor(access: SubscriptionAccessState): Date | null {
  switch (access.reason) {
    case 'trial_expired':
      return access.trialEndsAt;
    case 'subscription_expired':
    case 'payment_overdue':
      return access.currentPeriodEnd;
    case 'license_expired':
      return access.licenseExpiresAt ?? access.currentPeriodEnd ?? access.trialEndsAt;
    default:
      return access.currentPeriodEnd ?? access.trialEndsAt ?? access.licenseExpiresAt;
  }
}
