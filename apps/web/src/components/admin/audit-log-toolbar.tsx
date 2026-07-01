'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Props = {
  basePath: string;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  fixedQuery?: Record<string, string>;
};

export function AuditLogToolbar({
  basePath,
  total,
  page,
  totalPages,
  pageSize,
  fixedQuery = {},
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mergedParams() {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(fixedQuery)) {
      params.set(key, value);
    }
    return params;
  }

  function exportHref(format: 'csv' | 'json') {
    const params = mergedParams();
    params.set('format', format);
    return `/api/admin/audit/export?${params.toString()}`;
  }

  function setPageSize(nextSize: number) {
    const params = mergedParams();
    params.set('pageSize', String(nextSize));
    params.delete('page');
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  return (
    <div className="admin-audit-toolbar">
      <div className="admin-audit-toolbar__meta">
        <p className="text-sm font-medium">{total.toLocaleString('tr-TR')} kayıt</p>
        <p className="muted text-xs">
          Sayfa {page}/{totalPages} · {pageSize} / sayfa
        </p>
      </div>

      <div className="admin-audit-toolbar__actions">
        <label className="flex items-center gap-2 text-xs">
          <span className="muted">Göster</span>
          <select
            className="input py-1.5 text-xs"
            value={pageSize}
            disabled={pending}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <a href={exportHref('csv')} className="button button-gold px-4 py-2 text-xs">
          CSV indir
        </a>
        <a href={exportHref('json')} className="button px-4 py-2 text-xs">
          JSON indir
        </a>
      </div>
    </div>
  );
}
