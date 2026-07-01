'use client';

import {
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
} from '@/lib/admin/audit-labels';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type CategoryCount = {
  category: Exclude<AuditCategory, 'all'>;
  count: number;
};

type Props = {
  basePath: string;
  counts: CategoryCount[];
  total: number;
  fixedQuery?: Record<string, string>;
};

const CATEGORY_ORDER: Exclude<AuditCategory, 'all'>[] = [
  'security',
  'auth',
  'organization',
  'subscription',
  'license',
  'team',
  'members',
  'finance',
  'checkin',
  'devices',
  'settings',
];

export function AuditCategorySidebar({ basePath, counts, total, fixedQuery = {} }: Props) {
  const searchParams = useSearchParams();
  const active = (searchParams.get('category') ?? 'all') as AuditCategory;
  const countMap = new Map(counts.map((row) => [row.category, row.count]));

  function hrefFor(category: AuditCategory) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(fixedQuery)) {
      params.set(key, value);
    }
    if (category === 'all') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    params.delete('action');
    params.delete('page');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const items: { key: AuditCategory; count: number }[] = [
    { key: 'all', count: total },
    ...CATEGORY_ORDER.map((key) => ({ key, count: countMap.get(key) ?? 0 })),
  ];

  return (
    <aside className="admin-audit-sidebar" aria-label="Log kategorileri">
      <p className="admin-audit-sidebar__title">Kategoriler</p>
      <nav className="admin-audit-sidebar__nav">
        {items.map(({ key, count }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              href={hrefFor(key)}
              className="admin-audit-sidebar__item"
              data-active={isActive ? 'true' : 'false'}
            >
              <span className="admin-audit-sidebar__label">{AUDIT_CATEGORY_LABELS[key]}</span>
              <span className="admin-audit-sidebar__count">{count.toLocaleString('tr-TR')}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
