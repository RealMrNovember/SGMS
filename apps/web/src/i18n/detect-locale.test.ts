import { describe, expect, it } from 'vitest';
import { detectAutoLocale, detectLocale, detectLocaleFromCountry } from './detect-locale';

describe('detectLocaleFromCountry', () => {
  it('maps known countries to their locale', () => {
    expect(detectLocaleFromCountry('TR')).toBe('tr');
    expect(detectLocaleFromCountry('az')).toBe('az');
    expect(detectLocaleFromCountry('RU')).toBe('ru');
    expect(detectLocaleFromCountry('FR')).toBe('fr');
    expect(detectLocaleFromCountry('MX')).toBe('es');
  });

  it('returns null for unmapped or missing countries', () => {
    expect(detectLocaleFromCountry('DE')).toBeNull();
    expect(detectLocaleFromCountry(null)).toBeNull();
    expect(detectLocaleFromCountry(undefined)).toBeNull();
    expect(detectLocaleFromCountry('')).toBeNull();
  });
});

describe('detectLocale', () => {
  it('picks the first supported locale from Accept-Language', () => {
    expect(detectLocale('en-US,en;q=0.9,tr;q=0.8')).toBe('en');
    expect(detectLocale('tr-TR,tr;q=0.9')).toBe('tr');
  });

  it('falls back to the default locale when nothing matches', () => {
    expect(detectLocale('de-DE,de;q=0.9')).toBe('tr');
    expect(detectLocale(null)).toBe('tr');
  });
});

describe('detectAutoLocale', () => {
  it('prefers location over browser language when both are present', () => {
    expect(detectAutoLocale({ country: 'TR', acceptLanguage: 'en-US,en;q=0.9' })).toBe('tr');
  });

  it('falls back to browser language when location has no mapping', () => {
    expect(detectAutoLocale({ country: 'DE', acceptLanguage: 'fr-FR,fr;q=0.9' })).toBe('fr');
  });

  it('falls back to the default locale when neither signal resolves', () => {
    expect(detectAutoLocale({ country: null, acceptLanguage: null })).toBe('tr');
  });
});
