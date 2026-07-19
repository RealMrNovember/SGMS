import { describe, expect, it } from 'vitest';
import { resolveDeviceCheckInAccess } from '@/lib/billing/device-checkin-access';
import type { SubscriptionAccessState } from '@/lib/billing/subscription-gate';

function baseAccess(
  overrides: Partial<SubscriptionAccessState>,
): SubscriptionAccessState {
  return {
    mode: 'billing_only',
    reason: 'trial_expired',
    subscriptionStatus: 'EXPIRED',
    trialEndsAt: new Date('2026-07-10T12:00:00.000Z'),
    currentPeriodEnd: null,
    licenseExpiresAt: null,
    daysRemaining: 0,
    planName: 'Starter',
    centralLicenseStatus: 'EXPIRED',
    organizationStatus: 'ACTIVE',
    ...overrides,
  };
}

describe('resolveDeviceCheckInAccess', () => {
  it('allows devices when panel access is full', () => {
    const result = resolveDeviceCheckInAccess(
      baseAccess({ mode: 'full', reason: 'paid_active', subscriptionStatus: 'ACTIVE' }),
      { now: new Date('2026-07-19T12:00:00.000Z'), graceDays: 5 },
    );
    expect(result.allowed).toBe(true);
    expect(result.phase).toBe('full');
  });

  it('keeps turnstile open during the grace window after trial expiry', () => {
    const lockedAt = new Date('2026-07-15T12:00:00.000Z');
    const result = resolveDeviceCheckInAccess(
      baseAccess({ trialEndsAt: lockedAt, reason: 'trial_expired' }),
      { now: new Date('2026-07-18T12:00:00.000Z'), graceDays: 5 },
    );
    expect(result.allowed).toBe(true);
    expect(result.phase).toBe('grace');
    expect(result.graceDaysRemaining).toBe(2);
    expect(result.graceEndsAt?.toISOString()).toBe('2026-07-20T12:00:00.000Z');
  });

  it('blocks turnstile after grace days are exhausted', () => {
    const lockedAt = new Date('2026-07-10T12:00:00.000Z');
    const result = resolveDeviceCheckInAccess(
      baseAccess({ trialEndsAt: lockedAt, reason: 'trial_expired' }),
      { now: new Date('2026-07-19T12:00:00.000Z'), graceDays: 5 },
    );
    expect(result.allowed).toBe(false);
    expect(result.phase).toBe('blocked');
    expect(result.blockReason).toBe('grace_exhausted');
  });

  it('blocks immediately when the organization is suspended', () => {
    const result = resolveDeviceCheckInAccess(
      baseAccess({ reason: 'org_suspended' }),
      { now: new Date('2026-07-19T12:00:00.000Z'), graceDays: 5 },
    );
    expect(result.allowed).toBe(false);
    expect(result.phase).toBe('blocked');
    expect(result.blockReason).toBe('org_suspended');
  });

  it('uses currentPeriodEnd as lock anchor for PAST_DUE', () => {
    const periodEnd = new Date('2026-07-17T00:00:00.000Z');
    const result = resolveDeviceCheckInAccess(
      baseAccess({
        reason: 'payment_overdue',
        subscriptionStatus: 'PAST_DUE',
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      }),
      { now: new Date('2026-07-19T00:00:00.000Z'), graceDays: 5 },
    );
    expect(result.phase).toBe('grace');
    expect(result.allowed).toBe(true);
    expect(result.graceEndsAt?.toISOString()).toBe('2026-07-22T00:00:00.000Z');
  });
});
