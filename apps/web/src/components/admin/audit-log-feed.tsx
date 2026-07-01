'use client';

import {
  deleteAuditLog,
  deleteAuditLogs,
  deleteAuditLogsByFilter,
} from '@/actions/admin-audit';
import { AdminBadge } from '@/components/admin/admin-badge';
import {
  auditActionLabel,
  auditCategoryForAction,
  auditCategoryTone,
  auditSummary,
  AUDIT_CATEGORY_LABELS,
  formatAuditMetadata,
} from '@/lib/admin/audit-labels';
import type { AuditLogFilters } from '@/lib/admin/audit-query';
import { formatDateTimeTr } from '@/lib/admin/format';
import type { AuditAction } from '@sgms/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

export type AuditLogTableRow = {
  id: string;
  action: AuditAction;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  organizationId: string | null;
  organization: { id: string; name: string; slug: string } | null;
  actor: { id: string; name: string | null; email: string | null; isSuperAdmin: boolean } | null;
};

type Props = {
  logs: AuditLogTableRow[];
  showOrganizationColumn?: boolean;
  deletable?: boolean;
  filterSnapshot?: AuditLogFilters;
  filteredTotal?: number;
};

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  return date.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export function AuditLogFeed({
  logs,
  showOrganizationColumn = true,
  deletable = true,
  filterSnapshot,
  filteredTotal,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditLogTableRow[]>();
    for (const log of logs) {
      const key = dateGroupLabel(log.createdAt);
      const bucket = map.get(key) ?? [];
      bucket.push(log);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [logs]);

  const allSelected = logs.length > 0 && logs.every((log) => selected.has(log.id));
  const selectedCount = selected.size;
  const pageIds = useMemo(() => logs.map((log) => log.id), [logs]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }

  function runAction(action: () => Promise<{ error?: string; success?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setMessage(result.success ?? 'İşlem tamamlandı.');
      router.refresh();
    });
  }

  if (!logs.length) {
    return (
      <div className="admin-audit-empty">
        <p className="muted text-sm">Filtreye uygun log bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="admin-audit-feed">
      {deletable ? (
        <div className="admin-audit-delete-bar">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Tümünü seç
            </label>
            <button
              type="button"
              className="button px-3 py-1.5 text-xs"
              disabled={pending || !selectedCount}
              onClick={() => {
                if (!selectedCount) return;
                if (!window.confirm(`Seçili ${selectedCount} kaydı silmek istiyor musunuz?`)) return;
                runAction(() => deleteAuditLogs([...selected]));
              }}
            >
              Seçilenleri sil ({selectedCount})
            </button>
            {filterSnapshot && filteredTotal ? (
              <button
                type="button"
                className="button border-rose-500/40 px-3 py-1.5 text-xs text-rose-200"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Filtreye uyan ${filteredTotal.toLocaleString('tr-TR')} kaydı silmek istiyor musunuz?`,
                    )
                  ) {
                    return;
                  }
                  runAction(() => deleteAuditLogsByFilter(filterSnapshot, filteredTotal));
                }}
              >
                Filtreyi temizle ({filteredTotal.toLocaleString('tr-TR')})
              </button>
            ) : null}
          </div>
          {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      ) : null}

      {grouped.map(([group, items]) => (
        <section key={group} className="admin-audit-feed__group">
          <h3 className="admin-audit-feed__group-title">{group}</h3>
          <ul className="admin-audit-feed__list">
            {items.map((log) => {
              const category = auditCategoryForAction(log.action);
              const summary = auditSummary(log.metadata, log.action);
              const metadataText = formatAuditMetadata(log.metadata);
              const createdAt = new Date(log.createdAt);

              return (
                <li key={log.id} className="admin-audit-feed__item">
                  {deletable ? (
                    <input
                      type="checkbox"
                      className="admin-audit-feed__check"
                      aria-label={`${auditActionLabel(log.action)} seç`}
                      checked={selected.has(log.id)}
                      onChange={() => toggleOne(log.id)}
                    />
                  ) : null}

                  <div className="admin-audit-feed__time">
                    {createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>

                  <div className="admin-audit-feed__body">
                    <div className="admin-audit-feed__head">
                      <AdminBadge
                        label={auditActionLabel(log.action)}
                        tone={auditCategoryTone(category, log.action)}
                      />
                      <span className="admin-audit-feed__category">{AUDIT_CATEGORY_LABELS[category]}</span>
                    </div>

                    <p className="admin-audit-feed__summary">{summary}</p>

                    <div className="admin-audit-feed__meta">
                      {showOrganizationColumn ? (
                        <span>
                          {log.organization ? (
                            <Link
                              href={`/admin/organizations/${log.organization.id}/audit`}
                              className="hover:text-white"
                            >
                              {log.organization.name}
                            </Link>
                          ) : (
                            <span className="muted">Platform</span>
                          )}
                        </span>
                      ) : null}
                      <span>{log.actor?.name ?? 'Sistem'}</span>
                      {log.actor?.email ? <span className="muted">{log.actor.email}</span> : null}
                      {log.actor?.isSuperAdmin ? (
                        <span className="text-[#c9a962]">Master Admin</span>
                      ) : null}
                      {log.ipAddress ? <span className="font-mono text-white/50">{log.ipAddress}</span> : null}
                    </div>

                    {(metadataText || log.userAgent || log.entityId) && (
                      <details className="admin-audit-details mt-2">
                        <summary className="cursor-pointer text-xs text-[#c9a962]">Teknik detay</summary>
                        <div className="admin-audit-details__body mt-2 space-y-2 text-xs">
                          <p className="muted">{formatDateTimeTr(createdAt)}</p>
                          {log.entityType ? (
                            <p>
                              <span className="muted">Varlık:</span> {log.entityType}
                              {log.entityId ? ` · ${log.entityId}` : ''}
                            </p>
                          ) : null}
                          {log.userAgent ? (
                            <p className="break-all">
                              <span className="muted">UA:</span> {log.userAgent}
                            </p>
                          ) : null}
                          {metadataText ? (
                            <pre className="admin-audit-metadata">{metadataText}</pre>
                          ) : null}
                        </div>
                      </details>
                    )}
                  </div>

                  {deletable ? (
                    <button
                      type="button"
                      className="admin-audit-delete-btn shrink-0"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm('Bu kaydı silmek istiyor musunuz?')) return;
                        runAction(() => deleteAuditLog(log.id));
                      }}
                    >
                      Sil
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** @deprecated Use AuditLogFeed — kept for export route compatibility */
export const AuditLogTable = AuditLogFeed;
