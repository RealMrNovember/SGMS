import type { AppLocale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';

const INTL_LOCALE: Record<AppLocale, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  ru: 'ru-RU',
  fr: 'fr-FR',
  es: 'es-ES',
  az: 'az-AZ',
};

export function intlLocaleFor(locale: string): string {
  if (routing.locales.includes(locale as AppLocale)) {
    return INTL_LOCALE[locale as AppLocale];
  }
  return INTL_LOCALE[routing.defaultLocale];
}
