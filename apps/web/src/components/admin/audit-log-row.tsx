import { AdminBadge } from '@/components/admin/admin-badge';
import {
  auditActionLabel,
  auditCategoryForAction,
  auditCategoryTone,
  formatAuditMetadata,
} from '@/lib/admin/audit-labels';
import { formatDateTimeTr } from '@/lib/admin/format';
import type { AuditAction } from '@sgms/database';
import Link from 'next/link';

type AuditRow = {
  id: string;
  action: AuditAction;
  createdAt: Date;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  organizationId: string | null;
  organization: { id: string; name: string; slug: string } | null;
  actor: { id: string; name: string | null; email: string | null; isSuperAdmin: boolean } | null;
};

export function AuditLogRow({ log }: { log: AuditRow }) {
  const category = auditCategoryForAction(log.action);
  const metadataText = formatAuditMetadata(log.metadata);
  const hasDetails = Boolean(metadataText || log.ipAddress || log.userAgent || log.entityId);

  return (
    <li className="admin-audit-row">
      <div className="admin-audit-row__head">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge label={auditActionLabel(log.action)} tone={auditCategoryTone(category)} />
          <span className="muted text-xs">{formatDateTimeTr(log.createdAt)}</span>
        </div>
        <div className="muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {log.organization ? (
            <Link href={`/admin/organizations/${log.organization.id}`} className="hover:text-white">
              {log.organization.name}
            </Link>
          ) : (
            <span>Platform</span>
          )}
          <span>·</span>
          <span>
            {log.actor?.name ?? 'Sistem'}
            {log.actor?.isSuperAdmin ? ' (Master Admin)' : ''}
          </span>
          {log.actor?.email ? <span>· {log.actor.email}</span> : null}
        </div>
      </div>

      {hasDetails ? (
        <details className="admin-audit-details mt-3">
          <summary className="cursor-pointer text-xs text-[#c9a962]">Detayları göster</summary>
          <div className="admin-audit-details__body mt-3 space-y-2 text-xs">
            {log.entityType ? (
              <p>
                <span className="muted">Varlık:</span> {log.entityType}
                {log.entityId ? ` · ${log.entityId}` : ''}
              </p>
            ) : null}
            {log.ipAddress ? (
              <p>
                <span className="muted">IP:</span> {log.ipAddress}
              </p>
            ) : null}
            {log.userAgent ? (
              <p className="break-all">
                <span className="muted">User-Agent:</span> {log.userAgent}
              </p>
            ) : null}
            {metadataText ? <pre className="admin-audit-metadata">{metadataText}</pre> : null}
          </div>
        </details>
      ) : null}
    </li>
  );
}
