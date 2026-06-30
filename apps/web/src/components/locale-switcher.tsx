'use client';

import { setLocale } from '@/actions/locale';
import { routing, type AppLocale } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const localeLabels: Record<AppLocale, string> = {
  tr: 'TR',
  en: 'EN',
  ru: 'RU',
  fr: 'FR',
  es: 'ES',
  az: 'AZ',
};

type Props = {
  compact?: boolean;
};

export function LocaleSwitcher({ compact = false }: Props) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(nextLocale: AppLocale) {
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <select
      className={compact ? 'locale-switcher-compact' : 'input w-auto py-1.5 text-sm'}
      value={locale}
      disabled={pending}
      onChange={(event) => onChange(event.target.value as AppLocale)}
      aria-label="Language"
    >
      {routing.locales.map((code) => (
        <option key={code} value={code}>
          {localeLabels[code]}
        </option>
      ))}
    </select>
  );
}
