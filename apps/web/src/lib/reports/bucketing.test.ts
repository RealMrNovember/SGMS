import { describe, expect, it } from 'vitest';
import { bucketCheckIns } from './bucketing';

describe('bucketCheckIns', () => {
  it('groups timestamps by UTC date', () => {
    const result = bucketCheckIns([
      new Date('2026-07-01T08:00:00.000Z'),
      new Date('2026-07-01T18:00:00.000Z'),
      new Date('2026-07-02T09:00:00.000Z'),
    ]);

    expect(result.dailyVisitors).toEqual([
      { date: '2026-07-01', count: 2 },
      { date: '2026-07-02', count: 1 },
    ]);
  });

  it('ranks the busiest hour first (in the gym local time zone, not UTC)', () => {
    // Europe/Istanbul is UTC+3 — 18:00 UTC is 21:00 local.
    const result = bucketCheckIns([
      new Date('2026-07-01T18:00:00.000Z'),
      new Date('2026-07-02T18:30:00.000Z'),
      new Date('2026-07-03T09:00:00.000Z'),
    ]);

    expect(result.busiestHours[0]).toEqual({ hour: 21, count: 2 });
  });

  it('ranks the busiest day of week first', () => {
    // 2026-07-01 is a Wednesday (day 3)
    const result = bucketCheckIns([
      new Date('2026-07-01T08:00:00.000Z'),
      new Date('2026-07-08T08:00:00.000Z'),
      new Date('2026-07-02T08:00:00.000Z'),
    ]);

    expect(result.busiestDays[0].count).toBe(2);
  });

  it('returns all 24 hours and 7 days even with sparse data', () => {
    const result = bucketCheckIns([new Date('2026-07-01T00:00:00.000Z')]);
    expect(result.busiestHours).toHaveLength(24);
    expect(result.busiestDays).toHaveLength(7);
  });

  it('handles an empty input without throwing', () => {
    const result = bucketCheckIns([]);
    expect(result.dailyVisitors).toEqual([]);
    expect(result.busiestHours.every((h) => h.count === 0)).toBe(true);
  });

  it('rolls a late-UTC timestamp into the next local day when the gym is ahead of UTC', () => {
    // 22:00 UTC on 2026-07-01 is 01:00 local on 2026-07-02 in Europe/Istanbul (UTC+3).
    const result = bucketCheckIns([new Date('2026-07-01T22:00:00.000Z')]);
    expect(result.dailyVisitors).toEqual([{ date: '2026-07-02', count: 1 }]);
  });

  it('respects a custom time zone', () => {
    // 22:00 UTC stays on the same calendar day in a UTC-based zone.
    const result = bucketCheckIns([new Date('2026-07-01T22:00:00.000Z')], 'UTC');
    expect(result.dailyVisitors).toEqual([{ date: '2026-07-01', count: 1 }]);
  });
});
