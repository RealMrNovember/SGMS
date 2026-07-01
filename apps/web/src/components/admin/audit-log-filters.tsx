'use client';

import type { AuditAction } from '@sgms/database';
import { AUDIT_ACTION_LABELS } from '@/lib/admin/audit-labels';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Props = {
  basePath: string;
  actions: AuditAction[];
  fixedQuery?: Record<string, string>;
  hideOrganizationFilter?: boolean;
};

export function AuditLogFilters({
  basePath,
  actions,
  fixedQuery = {},
  hideOrganizationFilter = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = searchParams.get('q') ?? '';
  const action = searchParams.get('action') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const showNoise = searchParams.get('showNoise') === '1';

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const nextQ = String(formData.get('q') ?? '').trim();
    const nextAction = String(formData.get('action') ?? '');
    const nextFrom = String(formData.get('from') ?? '');
    const nextTo = String(formData.get('to') ?? '');
    const nextShowNoise = formData.get('showNoise') === 'on';

    for (const [key, value] of Object.entries(fixedQuery)) {
      params.set(key, value);
    }

    const category = searchParams.get('category');
    if (category) params.set('category', category);

    if (nextQ) params.set('q', nextQ);
    if (nextAction) params.set('action', nextAction);
    if (nextFrom) params.set('from', nextFrom);
    if (nextTo) params.set('to', nextTo);
    if (nextShowNoise) params.set('showNoise', '1');

    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  return (
    <form
      action={apply}
      className="admin-audit-filters card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5"
    >
      <div className="space-y-2 xl:col-span-2">
        <label htmlFor="audit-q" className="admin-kicker">
          Ara
        </label>
        <input
          id="audit-q"
          name="q"
          defaultValue={q}
          placeholder={
            hideOrganizationFilter
              ? 'E-posta, IP, varlık, olay…'
              : 'Salon, e-posta, IP, varlık…'
          }
          className="input w-full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="audit-action" className="admin-kicker">
          Olay türü
        </label>
        <select id="audit-action" name="action" defaultValue={action} className="input w-full">
          <option value="">Tüm olaylar</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {AUDIT_ACTION_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="audit-from" className="admin-kicker">
          Başlangıç
        </label>
        <input id="audit-from" name="from" type="date" defaultValue={from} className="input w-full" />
      </div>

      <div className="space-y-2">
        <label htmlFor="audit-to" className="admin-kicker">
          Bitiş
        </label>
        <input id="audit-to" name="to" type="date" defaultValue={to} className="input w-full" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 md:col-span-2 xl:col-span-5">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" name="showNoise" defaultChecked={showNoise} />
          Lisans senkron gürültüsünü göster
        </label>
        <div className="flex gap-2">
          <button type="submit" className="button button-gold px-5 py-2.5 text-sm" disabled={pending}>
            {pending ? 'Filtreleniyor…' : 'Uygula'}
          </button>
          <a href={basePath} className="button px-5 py-2.5 text-sm">
            Sıfırla
          </a>
        </div>
      </div>
    </form>
  );
}
