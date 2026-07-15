import { ReportsExportButton } from '@/components/reports/reports-export-button';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import {
  getMembershipMetrics,
  getOperationalReport,
  resolveDateRange,
  type DateRange,
} from '@/lib/reports/queries';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const VIEWER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
const RANGE_PRESETS = ['7d', '30d', '90d', 'month'] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

function isRangePreset(value: string | undefined): value is RangePreset {
  return !!value && (RANGE_PRESETS as readonly string[]).includes(value);
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !VIEWER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const preset: RangePreset = isRangePreset(params.range) ? params.range : '30d';
  const range: DateRange = resolveDateRange(preset);

  const t = await getTranslations('reports');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);
  const organizationId = session.user.organizationId;

  const [operational, membership] = await Promise.all([
    getOperationalReport(organizationId, range),
    getMembershipMetrics(organizationId, range),
  ]);

  const maxDailyVisitor = Math.max(1, ...operational.dailyVisitors.map((d) => d.count));
  const maxHour = Math.max(1, ...operational.busiestHours.map((h) => h.count));
  const topHours = [...operational.busiestHours].sort((a, b) => a.hour - b.hour);
  const topDays = [...operational.busiestDays].sort((a, b) => b.count - a.count).slice(0, 3);

  const currency = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  });

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
              href={`/dashboard/reports?range=${p}`}
              className={p === preset ? 'button button-gold px-4 py-2 text-xs' : 'button px-4 py-2 text-xs'}
            >
              {t(`range.${p}`)}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.activeMembers')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{membership.activeMembers}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.newMembers')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{membership.newMembers}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.churned')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{membership.churnedMembers}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.renewalRate')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {membership.renewalRate !== null ? `%${membership.renewalRate}` : '—'}
          </p>
          {membership.expiredInPeriod > 0 ? (
            <p className="muted mt-1 text-xs">{t('kpi.expiredInPeriod', { count: membership.expiredInPeriod })}</p>
          ) : null}
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.mrr')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#c9a962]">
            {currency.format(membership.mrr)}
          </p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.avgTenure')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{t('kpi.months', { count: membership.avgTenureMonths })}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.ltv')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{currency.format(membership.ltv)}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpi.totalVisits')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{operational.totalVisits}</p>
        </article>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t('dailyVisitors.title')}</h3>
          <ReportsExportButton
            filename={`sgms-ziyaretci-trendi-${preset}.csv`}
            headers={[t('dailyVisitors.colDate'), t('dailyVisitors.colCount')]}
            rows={operational.dailyVisitors.map((d) => [d.date, String(d.count)])}
            label={t('export')}
          />
        </div>
        {operational.dailyVisitors.length === 0 ? (
          <p className="muted mt-4 text-sm">{t('empty')}</p>
        ) : (
          <div className="mt-5 flex items-end gap-1 overflow-x-auto pb-2">
            {operational.dailyVisitors.map((d) => (
              <div key={d.date} className="flex min-w-[28px] flex-col items-center gap-1">
                <div
                  className="w-4 rounded-t bg-[#c9a962]/70"
                  style={{ height: `${Math.max(4, (d.count / maxDailyVisitor) * 96)}px` }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="muted text-[9px]">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold">{t('busiestHours.title')}</h3>
          <div className="mt-4 space-y-1.5">
            {topHours.map((h) => (
              <div key={h.hour} className="flex items-center gap-2 text-xs">
                <span className="muted w-10 tabular-nums">{String(h.hour).padStart(2, '0')}:00</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-[#c9a962]/70"
                    style={{ width: `${(h.count / maxHour) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums">{h.count}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-5">
          <h3 className="font-semibold">{t('busiestDays.title')}</h3>
          <ul className="muted mt-4 space-y-2 text-sm">
            {topDays.map((d) => (
              <li key={d.day} className="flex items-center justify-between">
                <span>{t(`weekday.${WEEKDAY_KEYS[d.day]}`)}</span>
                <span className="tabular-nums text-white">{d.count}</span>
              </li>
            ))}
            {topDays.length === 0 ? <li>{t('empty')}</li> : null}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <h3 className="font-semibold">{t('topTrainers.title')}</h3>
            <ReportsExportButton
              filename={`sgms-en-cok-satan-pt-${preset}.csv`}
              headers={[t('topTrainers.colName'), t('topTrainers.colSessions'), t('topTrainers.colRevenue')]}
              rows={operational.topTrainers.map((row) => [row.name, String(row.sessions), String(row.revenue)])}
              label={t('export')}
            />
          </div>
          {operational.topTrainers.length === 0 ? (
            <p className="muted p-5 text-sm">{t('empty')}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-2 font-medium">{t('topTrainers.colName')}</th>
                  <th className="px-5 py-2 font-medium">{t('topTrainers.colSessions')}</th>
                  <th className="px-5 py-2 font-medium">{t('topTrainers.colRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {operational.topTrainers.map((row) => (
                  <tr key={row.trainerUserId} className="border-t border-[var(--border)]">
                    <td className="px-5 py-2">{row.name}</td>
                    <td className="px-5 py-2 tabular-nums">{row.sessions}</td>
                    <td className="px-5 py-2 tabular-nums text-[#c9a962]">{currency.format(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <h3 className="font-semibold">{t('topCategories.title')}</h3>
            <ReportsExportButton
              filename={`sgms-en-cok-satan-urun-${preset}.csv`}
              headers={[t('topCategories.colName'), t('topCategories.colRevenue')]}
              rows={operational.topCategories.map((row) => [row.name, String(row.revenue)])}
              label={t('export')}
            />
          </div>
          {operational.topCategories.length === 0 ? (
            <p className="muted p-5 text-sm">{t('empty')}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-2 font-medium">{t('topCategories.colName')}</th>
                  <th className="px-5 py-2 font-medium">{t('topCategories.colRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {operational.topCategories.map((row) => (
                  <tr key={row.categoryId ?? 'none'} className="border-t border-[var(--border)]">
                    <td className="px-5 py-2">{row.name}</td>
                    <td className="px-5 py-2 tabular-nums text-[#c9a962]">{currency.format(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </div>
  );
}
