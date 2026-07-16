'use client';

import { ChevronsLeft, ChevronsRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
};

export type AppNavGroup = {
  title?: string;
  items: AppNavItem[];
};

const STORAGE_KEY = 'sgms-sidebar-collapsed';

function NavBadge({ value }: { value?: number }) {
  if (!value || value <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {value > 99 ? '99+' : value}
    </span>
  );
}

export function AppSidebarNav({ groups }: { groups: AppNavGroup[] }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === 'true';
    setCollapsed(stored);
    document.documentElement.dataset.sidebarCollapsed = stored ? 'true' : 'false';
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebarCollapsed = next ? 'true' : 'false';
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <nav className="space-y-1">
      {groups.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title ? <p className="app-sidebar-group-title">{group.title}</p> : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="app-sidebar-link"
                  data-active={active ? 'true' : 'false'}
                  title={item.label}
                >
                  <Icon />
                  <span className="app-sidebar-label">{item.label}</span>
                  <NavBadge value={item.badge} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={toggleCollapsed}
        className="app-sidebar-collapse-btn mt-2"
        title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        <span className="app-sidebar-label">{t('collapseSidebar')}</span>
      </button>
    </nav>
  );
}
