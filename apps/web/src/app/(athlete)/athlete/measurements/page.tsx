import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

export default async function AthleteMeasurementsPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const measurements = await prisma.healthMeasurement.findMany({
    where: {
      organizationId: session.user.organizationId,
      gymMemberId: session.user.gymMemberId,
    },
    orderBy: { measuredAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {t('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{t('pages.measurements')}</h2>
        <p className="muted mt-1 text-sm">{t('measurementsCount', { count: measurements.length })}</p>
      </div>

      {measurements.length === 0 ? (
        <section className="card p-5">
          <p className="muted text-sm">{t('noMeasurements')}</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {measurements.map((measurement) => (
              <article key={measurement.id} className="px-5 py-4">
                <p className="font-medium">
                  {measurement.measuredAt.toLocaleDateString(dateLocale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <dl className="muted mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt>{t('fields.weight')}</dt>
                    <dd className="text-white">{formatDecimal(measurement.weight)} kg</dd>
                  </div>
                  <div>
                    <dt>{t('fields.bodyFat')}</dt>
                    <dd className="text-white">{formatDecimal(measurement.bodyFatPercentage)}%</dd>
                  </div>
                  <div>
                    <dt>{t('fields.muscle')}</dt>
                    <dd className="text-white">{formatDecimal(measurement.muscleMass)} kg</dd>
                  </div>
                  {measurement.notes ? (
                    <div className="col-span-2">
                      <dt>{t('fields.notes')}</dt>
                      <dd className="text-white">{measurement.notes}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
