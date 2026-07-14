import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and dashes spaces', () => {
    expect(slugify('CiciByte Fitness Center')).toBe('cicibyte-fitness-center');
  });

  it('strips Turkish diacritics', () => {
    expect(slugify('Şişli Güç Spor')).toBe('sisli-guc-spor');
  });

  it('collapses repeated separators and trims edge dashes', () => {
    expect(slugify('  --Multi   Salon--  ')).toBe('multi-salon');
  });

  it('caps length at 64 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long)).toHaveLength(64);
  });
});
