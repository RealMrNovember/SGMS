import { ReportsExportButton } from '@/components/reports/reports-export-button';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { getUserHierarchyScopes } from '@/lib/enterprise/hierarchy';
import { getConsolidatedReport } from '@/lib/enterprise/queries';
import { resolveDateRange, type DateRange } from '@/lib/reports/queries';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const RANGE_PRESETS = ['7d', '30d', '90d', 'month'] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

function isRangePreset(value: string | undefined): value is RangePreset {
  return !!value && (RANGE_PRESETS as readonly string[]).includes(value);
}

export default async function EnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; node?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const t = await getTranslations('enterprise');

  if (!session.user.isHierarchyMember) {
    redirect('/dashboard');
  }

  const scopes = await getUserHierarchyScopes(session.user.id);
  if (scopes.length === 0) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const preset: RangePreset = isRangePreset(params.range) ? params.range : '30d';
  const range: DateRange = resolveDateRange(preset);

  const activeScope = scopes.find((s) => s.organization.id === params.node) ?? scopes[0];

  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);
  const currency = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  });

  const report = await getConsolidatedReport(activeScope.organization.id, range);

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="muted mt-2 text-sm leading-6">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((p) => (
            <Link
              key={p}
              href={`/dashboard/enterprise?range=${p}&node=${activeScope.organization.id}`}
              className={p === preset ? 'button button-gold px-4 py-2 text-xs' : 'button px-4 py-2 text-xs'}
            >
              {t(`range.${p}`)}
            </Link>
          ))}
        </div>
      </section>

      {scopes.length > 1 ? (
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <span className="muted text-sm">{t('nodeSelector')}</span>
          {scopes.map((scope) => (
            <Link
              key={scope.organization.id}
              href={`/dashboard/enterprise?range=${preset}&node=${scope.organization.id}`}
              className={
                scope.organization.id === activeScope.organization.id
                  ? 'button button-gold px-3 py-1.5 text-xs'
                  : 'button px-3 py-1.5 text-xs'
              }
            >
              {scope.organization.name} · {scope.role}
            </Link>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.branchCount')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{report.branchCount}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.totalActiveMembers')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{report.totalActiveMembers}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.totalStaff')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{report.totalStaff}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.totalRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#c9a962]">
            {currency.format(report.totalRevenue)}
          </p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.totalCheckIns')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{report.totalCheckIns}</p>
        </article>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('branchTable.title')}</h3>
          <ReportsExportButton
            filename={`sgms-kurumsal-subeler-${preset}.csv`}
            headers={[
              t('branchTable.colBranch'),
              t('branchTable.colOwner'),
              t('branchTable.colMembers'),
              t('branchTable.colStaff'),
              t('branchTable.colRevenue'),
              t('branchTable.colCheckIns'),
            ]}
            rows={report.branches.map((b) => [
              b.organizationName,
              b.ownerName ?? '',
              String(b.activeMembers),
              String(b.staffCount),
              String(b.revenue),
              String(b.checkIns),
            ])}
            label={t('export')}
          />
        </div>
        {report.branches.length === 0 ? (
          <p className="muted p-5 text-sm">{t('empty')}</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="muted text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2 font-medium">{t('branchTable.colBranch')}</th>
                <th className="px-5 py-2 font-medium">{t('branchTable.colOwner')}</th>
                <th className="px-5 py-2 font-medium">{t('branchTable.colMembers')}</th>
                <th className="px-5 py-2 font-medium">{t('branchTable.colStaff')}</th>
                <th className="px-5 py-2 font-medium">{t('branchTable.colRevenue')}</th>
                <th className="px-5 py-2 font-medium">{t('branchTable.colCheckIns')}</th>
              </tr>
            </thead>
            <tbody>
              {report.branches.map((b) => (
                <tr key={b.organizationId} className="border-t border-[var(--border)]">
                  <td className="px-5 py-2">
                    {scopes.some((s) => s.organization.id === b.organizationId) ? (
                      <Link
                        href={`/dashboard/enterprise?range=${preset}&node=${b.organizationId}`}
                        className="hover:underline"
                      >
                        {b.organizationName}
                      </Link>
                    ) : (
                      b.organizationName
                    )}
                  </td>
                  <td className="px-5 py-2">{b.ownerName ?? '—'}</td>
                  <td className="px-5 py-2 tabular-nums">{b.activeMembers}</td>
                  <td className="px-5 py-2 tabular-nums">{b.staffCount}</td>
                  <td className="px-5 py-2 tabular-nums text-[#c9a962]">{currency.format(b.revenue)}</td>
                  <td className="px-5 py-2 tabular-nums">{b.checkIns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
