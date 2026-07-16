'use client';

import { setLocale } from '@/actions/locale';
import { useClickOutside } from '@/lib/use-click-outside';
import { routing, type AppLocale } from '@/i18n/routing';
import { Check, Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

const localeLabels: Record<AppLocale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  fr: 'Français',
  es: 'Español',
  az: 'Azərbaycan',
};

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  function onChange(nextLocale: AppLocale) {
    setOpen(false);
    if (nextLocale === locale) return;
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="locale-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="locale-switcher-trigger"
      >
        <Globe size={16} />
        <span className="locale-switcher-code">{locale.toUpperCase()}</span>
      </button>

      {open ? (
        <div role="menu" className="locale-switcher-menu">
          {routing.locales.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              onClick={() => onChange(code)}
              className="locale-switcher-option"
              data-active={code === locale ? 'true' : 'false'}
            >
              <span>{localeLabels[code]}</span>
              {code === locale ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
