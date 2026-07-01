import { AuditCategorySidebar } from '@/components/admin/audit-category-sidebar';
import { AuditLogFilters as AuditLogFiltersForm } from '@/components/admin/audit-log-filters';
import { AuditLogFeed, type AuditLogTableRow } from '@/components/admin/audit-log-feed';
import { AuditLogToolbar } from '@/components/admin/audit-log-toolbar';
import { auditActionLabel } from '@/lib/admin/audit-labels';
import { auditPageHref, type AuditPageParams } from '@/lib/admin/audit-path';
import {
  ALL_AUDIT_ACTIONS,
  getAuditLogStats,
  getCategoryCounts,
  listAuditLogsFiltered,
  type AuditLogFilters,
} from '@/lib/admin/queries';
import type { AuditCategory } from '@/lib/admin/audit-labels';
import type { AuditAction } from '@sgms/database';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';

type Props = {
  basePath: string;
  pageParams: AuditPageParams;
  filters: AuditLogFilters;
  organization?: { id: string; name: string; slug: string } | null;
  showOrganizationColumn?: boolean;
  showPlatformStats?: boolean;
};

function serializeLogs(
  items: Awaited<ReturnType<typeof listAuditLogsFiltered>>['items'],
): AuditLogTableRow[] {
  return items.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    organizationId: log.organizationId,
    organization: log.organization,
    actor: log.actor,
  }));
}

export async function AdminAuditLogSection({
  basePath,
  pageParams,
  filters,
  organization = null,
  showOrganizationColumn = true,
  showPlatformStats = true,
}: Props) {
  const tAdmin = await getTranslations('admin');
  const page = Math.max(1, Number(pageParams.page ?? '1') || 1);
  const pageSize = Math.min(200, Math.max(25, Number(pageParams.pageSize ?? '50') || 50));

  const [{ items, total, totalPages, pageSize: effectivePageSize }, stats, categoryCounts] =
    await Promise.all([
      listAuditLogsFiltered(filters, page, pageSize),
      getAuditLogStats(filters),
      getCategoryCounts(filters),
    ]);

  const fixedQuery = organization ? { organizationId: organization.id } : undefined;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          {organization ? (
            <>
              <Link
                href={`/admin/organizations/${organization.id}`}
                className="muted text-sm hover:underline"
              >
                ← {organization.name}
              </Link>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {tAdmin('auditOrgTitle', { name: organization.name })}
              </h2>
            </>
          ) : (
            <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('auditTitle')}</h2>
          )}
          <p className="muted mt-2 max-w-3xl text-sm">
            {organization ? tAdmin('auditOrgSubtitle') : tAdmin('auditSubtitle')}
          </p>
        </div>
        <div className="admin-audit-retention">
          <span className="admin-audit-retention__icon" aria-hidden>
            ∞
          </span>
          <p className="text-sm">{tAdmin('auditRetention')}</p>
        </div>
      </section>

      <section
        className={`grid gap-4 sm:grid-cols-2 ${showPlatformStats ? 'xl:grid-cols-5' : 'lg:grid-cols-3'}`}
      >
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Toplam kayıt</p>
          <p className="mt-2 text-3xl font-semibold">{stats.total.toLocaleString('tr-TR')}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Bugün</p>
          <p className="mt-2 text-3xl font-semibold">{stats.today.toLocaleString('tr-TR')}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Başarısız giriş (bugün)</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300">
            {stats.failedLoginsToday.toLocaleString('tr-TR')}
          </p>
        </article>
        {showPlatformStats ? (
          <>
            <article className="admin-stat rounded-2xl p-5">
              <p className="admin-kicker">Aktif salon</p>
              <p className="mt-2 text-3xl font-semibold">{stats.activeOrganizations}</p>
            </article>
            <article className="admin-stat rounded-2xl p-5">
              <p className="admin-kicker">En sık olay</p>
              <p className="mt-2 text-sm font-medium leading-6">
                {stats.topActions[0]
                  ? `${auditActionLabel(stats.topActions[0].action)} (${stats.topActions[0].count})`
                  : '—'}
              </p>
            </article>
          </>
        ) : null}
      </section>

      <div className="admin-audit-layout">
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <AuditCategorySidebar
            basePath={basePath}
            counts={categoryCounts}
            total={stats.total}
            fixedQuery={fixedQuery}
          />
        </Suspense>

        <div className="admin-audit-main space-y-4">
          <Suspense fallback={<div className="card h-16 animate-pulse p-5" />}>
            <AuditLogFiltersForm
              basePath={basePath}
              actions={ALL_AUDIT_ACTIONS}
              fixedQuery={fixedQuery}
              hideOrganizationFilter={Boolean(organization)}
            />
          </Suspense>

          <section className="card overflow-hidden">
            <Suspense fallback={<div className="h-14 animate-pulse border-b border-[var(--border)]" />}>
              <AuditLogToolbar
                basePath={basePath}
                total={total}
                page={page}
                totalPages={totalPages}
                pageSize={effectivePageSize}
                fixedQuery={fixedQuery}
              />
            </Suspense>
            <AuditLogFeed
              logs={serializeLogs(items)}
              showOrganizationColumn={showOrganizationColumn}
              filterSnapshot={filters}
              filteredTotal={total}
            />
          </section>
        </div>
      </div>

      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={auditPageHref(basePath, pageParams, { page: String(page - 1) })}
              className="button px-4 py-2 text-sm"
            >
              ← Önceki
            </Link>
          ) : null}
          <span className="muted px-3 text-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={auditPageHref(basePath, pageParams, { page: String(page + 1) })}
              className="button px-4 py-2 text-sm"
            >
              Sonraki →
            </Link>
          ) : null}
        </nav>
      ) : null}

      {!organization ? (
        <p className="muted text-center text-xs">
          Belirli bir salon için{' '}
          <Link href="/admin/organizations" className="text-[#c9a962] hover:underline">
            müşteri detayından
          </Link>{' '}
          salon loglarına da erişebilirsiniz.
        </p>
      ) : (
        <p className="muted text-center text-xs">
          <Link href="/admin/audit" className="text-[#c9a962] hover:underline">
            Tüm platform logları →
          </Link>
        </p>
      )}
    </div>
  );
}
