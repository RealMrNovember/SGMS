'use client';

import { setTheme, type AppTheme } from '@/actions/theme';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

type Props = {
  variant?: 'icon' | 'full';
};

export function ThemeToggle({ variant = 'icon' }: Props) {
  const t = useTranslations('common.theme');
  const [theme, setThemeState] = useState<AppTheme>('dark');
  const [, startTransition] = useTransition();

  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setThemeState(current);
  }, []);

  function toggle() {
    const next: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    startTransition(() => {
      void setTheme(next);
    });
  }

  const label = theme === 'dark' ? t('light') : t('dark');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('toggle')}
      title={label}
      className={variant === 'full' ? 'app-sidebar-collapse-btn' : 'icon-btn'}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      {variant === 'full' ? <span className="app-sidebar-label">{label}</span> : null}
    </button>
  );
}
