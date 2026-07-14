import { describe, expect, it } from 'vitest';
import { computeDaysRemaining, isCentralLicenseOperational } from './dashboard-license';

describe('computeDaysRemaining', () => {
  it('returns null when there is no expiry date', () => {
    expect(computeDaysRemaining(null)).toBeNull();
  });

  it('rounds up to the nearest full day', () => {
    const expiresAt = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25h from now
    expect(computeDaysRemaining(expiresAt)).toBe(2);
  });
});

describe('isCentralLicenseOperational', () => {
  it('is never operational when EXPIRED or REVOKED', () => {
    expect(isCentralLicenseOperational('EXPIRED', new Date(Date.now() + 1e9))).toBe(false);
    expect(isCentralLicenseOperational('REVOKED', new Date(Date.now() + 1e9))).toBe(false);
  });

  it('is always operational when UNKNOWN (no central record yet)', () => {
    expect(isCentralLicenseOperational('UNKNOWN', null)).toBe(true);
  });

  it('is operational for TRIAL/ACTIVE while not yet expired', () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isCentralLicenseOperational('TRIAL', future)).toBe(true);
    expect(isCentralLicenseOperational('ACTIVE', future)).toBe(true);
  });

  it('stops being operational once the expiry date has passed', () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isCentralLicenseOperational('ACTIVE', past)).toBe(false);
  });
});
