export const routing = {
  locales: ['tr', 'en', 'ru', 'fr', 'es', 'az'] as const,
  defaultLocale: 'tr' as const,
};

export type AppLocale = (typeof routing.locales)[number];
