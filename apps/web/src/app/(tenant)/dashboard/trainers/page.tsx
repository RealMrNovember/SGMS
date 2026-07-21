import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { listTrainersWithMonthlyStats } from '@/lib/trainers/queries';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function TrainersPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  const t = await getTranslations('trainers');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  if (role === 'TRAINER') {
    redirect(`/dashboard/trainers/${session.user.id}`);
  }

  const rows = await listTrainersWithMonthlyStats(session.user.organizationId);
  const monthLabel = new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(
    new Date(),
  );

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 text-sm leading-6">{t('subtitle', { month: monthLabel })}</p>
      </section>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-medium">{t('empty.title')}</p>
          <p className="muted mt-2 text-sm">{t('empty.subtitle')}</p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ user, profile, stats, isActive }) => (
            <Link
              key={user.id}
              href={`/dashboard/trainers/${user.id}`}
              className={`card block p-5 transition hover:border-[#c9a962]/40${!isActive ? ' opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{user.name}</p>
                <div className="flex items-center gap-1.5">
                  {!isActive ? <span className="badge text-[10px]">{t('inactiveBadge')}</span> : null}
                  {!profile ? <span className="badge text-[10px]">{t('noProfile')}</span> : null}
                </div>
              </div>
              <p className="muted text-xs">{user.email}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="muted text-xs">{t('kpi.sessions')}</p>
                  <p className="mt-1 font-semibold tabular-nums">{stats.sessionCount}</p>
                </div>
                <div>
                  <p className="muted text-xs">{t('kpi.hours')}</p>
                  <p className="mt-1 font-semibold tabular-nums">{stats.hoursWorked}</p>
                </div>
                <div>
                  <p className="muted text-xs">{t('kpi.revenue')}</p>
                  <p className="mt-1 font-semibold tabular-nums">{stats.grossRevenue.toLocaleString(dateLocale)} ₺</p>
                </div>
                <div>
                  <p className="muted text-xs">{t('kpi.commission')}</p>
                  <p className="mt-1 font-semibold tabular-nums text-[#c9a962]">
                    {stats.totalCommission.toLocaleString(dateLocale)} ₺
                  </p>
                </div>
              </div>
              {stats.noShowCount > 0 || stats.canceledCount > 0 ? (
                <p className="muted mt-3 text-xs">
                  {t('kpi.canceledAndNoShow', { canceled: stats.canceledCount, noShow: stats.noShowCount })}
                </p>
              ) : null}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
