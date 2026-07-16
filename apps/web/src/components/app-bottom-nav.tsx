'use client';

import type { AppNavGroup, AppNavItem } from '@/components/app-sidebar-nav';
import { LayoutGrid, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  primaryItems: AppNavItem[];
  groups: AppNavGroup[];
};

function isActive(pathname: string, item: AppNavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppBottomNav({ primaryItems, groups }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="app-bottom-nav">
        <div className="app-bottom-nav-grid mx-auto max-w-lg">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href} className="app-bottom-nav-link" data-active={active ? 'true' : 'false'}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="app-bottom-nav-link"
            data-active={sheetOpen ? 'true' : 'false'}
          >
            <LayoutGrid />
            <span>{t('more')}</span>
          </button>
        </div>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{t('more')}</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="icon-btn h-9 w-9"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {groups.map((group, index) => (
                <div key={group.title ?? index}>
                  {group.title ? <p className="app-sidebar-group-title">{group.title}</p> : null}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="app-sidebar-link"
                          data-active={active ? 'true' : 'false'}
                        >
                          <Icon />
                          <span className="app-sidebar-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
