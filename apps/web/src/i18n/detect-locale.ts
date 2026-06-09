import { routing, type AppLocale } from './routing';

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
