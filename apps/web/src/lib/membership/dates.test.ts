import { describe, expect, it } from 'vitest';
import { computeManualExtension, computeRenewalPeriod } from '@/lib/membership/dates';

describe('computeRenewalPeriod', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('stacks on top of an active membership end date', () => {
    const currentEndsAt = new Date('2026-07-25T12:00:00.000Z');
    const result = computeRenewalPeriod({
      currentEndsAt,
      durationDays: 30,
      now,
    });

    expect(result.stacked).toBe(true);
    expect(result.periodStartsAt).toBeNull();
    expect(result.membershipEndsAt.toISOString()).toBe('2026-08-24T12:00:00.000Z');
  });

  it('starts from today when membership is expired', () => {
    const currentEndsAt = new Date('2026-07-01T12:00:00.000Z');
    const result = computeRenewalPeriod({
      currentEndsAt,
      durationDays: 30,
      now,
    });

    expect(result.stacked).toBe(false);
    expect(result.periodStartsAt?.toISOString()).toBe(now.toISOString());
    expect(result.membershipEndsAt.toISOString()).toBe('2026-08-18T12:00:00.000Z');
  });

  it('starts from today when there is no end date', () => {
    const result = computeRenewalPeriod({
      currentEndsAt: null,
      durationDays: 7,
      now,
    });

    expect(result.stacked).toBe(false);
    expect(result.membershipEndsAt.toISOString()).toBe('2026-07-26T12:00:00.000Z');
  });
});

describe('computeManualExtension', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('adds complimentary days on top of active end', () => {
    const result = computeManualExtension({
      currentEndsAt: new Date('2026-07-20T12:00:00.000Z'),
      extraDays: 7,
      now,
    });
    expect(result.stacked).toBe(true);
    expect(result.membershipEndsAt.toISOString()).toBe('2026-07-27T12:00:00.000Z');
  });
});
