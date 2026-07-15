import { routing, type AppLocale } from './routing';

/** Cloudflare `CF-IPCountry` (ISO 3166-1 alpha-2) → desteklenen site dili. */
const COUNTRY_LOCALE_MAP: Record<string, AppLocale> = {
  TR: 'tr',
  AZ: 'az',
  RU: 'ru',
  BY: 'ru',
  KZ: 'ru',
  FR: 'fr',
  BE: 'fr',
  CH: 'fr',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  VE: 'es',
  EC: 'es',
  GT: 'es',
  CU: 'es',
  BO: 'es',
  DO: 'es',
  HN: 'es',
  PY: 'es',
  SV: 'es',
  NI: 'es',
  CR: 'es',
  PA: 'es',
  UY: 'es',
  GQ: 'es',
};

/** Ziyaretçinin konumundan (Cloudflare `CF-IPCountry` header'ı) dil tahmini. Eşleşme yoksa null. */
export function detectLocaleFromCountry(country: string | null | undefined): AppLocale | null {
  if (!country) {
    return null;
  }
  const code = country.trim().toUpperCase();
  return COUNTRY_LOCALE_MAP[code] ?? null;
}

/** Tarayıcının `Accept-Language` header'ından dil tahmini — eşleşme yoksa varsayılan dile döner. */
export function detectLocale(acceptLanguage: string | null | undefined): AppLocale {
  if (!acceptLanguage) {
    return routing.defaultLocale;
  }

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const lang of preferred) {
    const code = lang.split('-')[0] as AppLocale;
    if (routing.locales.includes(code)) {
      return code;
    }
  }

  return routing.defaultLocale;
}

/**
 * Otomatik dil tespiti: önce konum (CF-IPCountry), sonra tarayıcı dili (Accept-Language).
 * Kullanıcının açıkça seçtiği bir dil (çerez/oturum/salon ayarı) her zaman bunun önündedir —
 * bu yalnızca hiçbir açık tercih yokken ilk ziyarette kullanılır.
 */
export function detectAutoLocale(input: {
  country?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  return detectLocaleFromCountry(input.country) ?? detectLocale(input.acceptLanguage);
}
