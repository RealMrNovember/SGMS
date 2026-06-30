import { AddMeasurementForm } from '@/components/add-measurement-form';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

export default async function MemberMeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const canManage = role ? MEASUREMENT_ROLES.has(role) : false;

  const t = await getTranslations('measurements');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const member = await prisma.gymMember.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      email: true,
    },
  });

  if (!member) {
    notFound();
  }

  const measurements = await prisma.healthMeasurement.findMany({
    where: { organizationId, gymMemberId: id },
    orderBy: { measuredAt: 'desc' },
    take: 50,
  });

  const weightSeries = [...measurements]
    .filter((m) => m.weight != null)
    .reverse()
    .slice(-12);

  const fullName = `${member.firstName} ${member.lastName}`;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/members/${id}`} className="muted text-sm hover:text-white">
          {t('backToProfile')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('pageTitle', { name: fullName })}</h2>
        <p className="muted mt-2 text-sm">
          {member.email ?? tCommon('noEmail')} · {member.status}
        </p>
      </div>

      {weightSeries.length > 1 ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">
            {t('weightTrend', { count: weightSeries.length })}
          </h3>
          <div className="mt-4 flex h-32 items-end gap-2">
            {weightSeries.map((m) => {
              const max = Math.max(...weightSeries.map((x) => Number(x.weight)));
              const min = Math.min(...weightSeries.map((x) => Number(x.weight)));
              const range = max - min || 1;
              const height = ((Number(m.weight) - min) / range) * 100;
              return (
                <div key={m.id} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(height, 8)}%` }}
                    title={`${m.weight} kg`}
                  />
                  <span className="muted text-[10px]">
                    {m.measuredAt.toLocaleDateString(dateLocale, {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <AddMeasurementForm gymMemberId={id} canManage={canManage} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('historyTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('recordCount', { count: measurements.length })}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{t('columns.date')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.weight')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.bodyFat')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.muscle')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.height')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {measurements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted px-6 py-8 text-center">
                    {t('emptyShort')}
                  </td>
                </tr>
              ) : (
                measurements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">{m.measuredAt.toLocaleString(dateLocale)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.weight)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.bodyFatPercentage)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.muscleMass)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.height)}</td>
                    <td className="muted px-6 py-4">{m.notes ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
