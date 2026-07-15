import { describe, expect, it } from 'vitest';
import { calculateSessionCommission } from './commission';

describe('calculateSessionCommission', () => {
  it('returns the flat rate for FIXED_PER_SESSION regardless of revenue', () => {
    expect(
      calculateSessionCommission({ model: 'FIXED_PER_SESSION', baseRate: 150, revenueAmount: 500 }),
    ).toBe(150);
  });

  it('applies the percentage to revenue for PERCENTAGE_OF_REVENUE', () => {
    expect(
      calculateSessionCommission({ model: 'PERCENTAGE_OF_REVENUE', baseRate: 30, revenueAmount: 500 }),
    ).toBe(150);
  });

  it('rounds PERCENTAGE_OF_REVENUE to 2 decimals', () => {
    expect(
      calculateSessionCommission({ model: 'PERCENTAGE_OF_REVENUE', baseRate: 33.33, revenueAmount: 100 }),
    ).toBe(33.33);
  });

  it('uses the base rate for TIERED under the 20-session threshold', () => {
    expect(
      calculateSessionCommission({
        model: 'TIERED',
        baseRate: 20,
        revenueAmount: 500,
        sessionCountThisMonth: 10,
      }),
    ).toBe(100);
  });

  it('adds a 5-point bonus for TIERED at or above the 20-session threshold', () => {
    expect(
      calculateSessionCommission({
        model: 'TIERED',
        baseRate: 20,
        revenueAmount: 500,
        sessionCountThisMonth: 20,
      }),
    ).toBe(125);
  });

  it('caps the effective TIERED rate at 100%', () => {
    expect(
      calculateSessionCommission({
        model: 'TIERED',
        baseRate: 98,
        revenueAmount: 500,
        sessionCountThisMonth: 25,
      }),
    ).toBe(500);
  });
});
