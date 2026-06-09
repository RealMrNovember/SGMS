import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['tr', 'en', 'ru', 'fr', 'es', 'az'],
  defaultLocale: 'tr',
  localePrefix: 'never',
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];
