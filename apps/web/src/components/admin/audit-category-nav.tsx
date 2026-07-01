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

export function AuditCategoryNav({ basePath, counts, total, fixedQuery = {} }: Props) {
  const searchParams = useSearchParams();
  const active = (searchParams.get('category') ?? 'all') as AuditCategory;

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
    params.delete('page');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const countMap = new Map(counts.map((row) => [row.category, row.count]));

  const pills: { key: AuditCategory; count: number }[] = [
    { key: 'all', count: total },
    ...(
      Object.keys(AUDIT_CATEGORY_LABELS).filter((k) => k !== 'all') as Exclude<
        AuditCategory,
        'all'
      >[]
    ).map((key) => ({ key, count: countMap.get(key) ?? 0 })),
  ];

  return (
    <nav className="admin-audit-categories" aria-label="Log kategorileri">
      {pills.map(({ key, count }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            className="admin-audit-category"
            data-active={isActive ? 'true' : 'false'}
          >
            <span>{AUDIT_CATEGORY_LABELS[key]}</span>
            <span className="admin-audit-category__count">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
