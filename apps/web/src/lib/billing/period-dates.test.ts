import { describe, expect, it } from 'vitest';
import { isPeriodStillValid, parsePeriodEndInput } from './period-dates';

describe('parsePeriodEndInput', () => {
  it('parses an HTML date input to local end-of-day', () => {
    const date = parsePeriodEndInput('2026-08-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // 0-indexed → August
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });

  it('falls back to native Date parsing for non-matching input', () => {
    const date = parsePeriodEndInput('2026-08-15T10:00:00Z');
    expect(Number.isNaN(date.getTime())).toBe(false);
  });
});

describe('isPeriodStillValid', () => {
  it('treats a null/undefined end date as always valid', () => {
    expect(isPeriodStillValid(null)).toBe(true);
    expect(isPeriodStillValid(undefined)).toBe(true);
  });

  it('is valid when the end date is in the future', () => {
    expect(isPeriodStillValid(new Date(Date.now() + 86_400_000))).toBe(true);
  });

  it('is invalid when the end date is in the past', () => {
    expect(isPeriodStillValid(new Date(Date.now() - 86_400_000))).toBe(false);
  });
});
