import { AddMeasurementForm } from '@/components/add-measurement-form';
import { MeasurementSparkline } from '@/components/measurement-sparkline';
import { computeBmi } from '@/lib/measurements/bmi';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

function buildSparklineSeries(
  measurements: Array<{ measuredAt: Date; value: { toString: () => string } | null }>,
) {
  return [...measurements]
    .filter((m) => m.value != null)
    .reverse()
    .slice(-6)
    .map((m) => ({
      at: m.measuredAt.toISOString(),
      value: Number(m.value!.toString()),
    }));
}

export default async function AthleteMeasurementsPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('measurements');
  const tAthlete = await getTranslations('athlete');
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

  const chronological = [...measurements].reverse();
  const weightSeries = buildSparklineSeries(
    chronological.map((m) => ({ measuredAt: m.measuredAt, value: m.weight })),
  );
  const bodyFatSeries = buildSparklineSeries(
    chronological.map((m) => ({ measuredAt: m.measuredAt, value: m.bodyFatPercentage })),
  );
  const waistSeries = buildSparklineSeries(
    chronological.map((m) => ({ measuredAt: m.measuredAt, value: m.waistCm })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {tAthlete('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{tAthlete('pages.measurements')}</h2>
        <p className="muted mt-1 text-sm">{tAthlete('measurementsCount', { count: measurements.length })}</p>
      </div>

      {weightSeries.length > 1 || bodyFatSeries.length > 1 || waistSeries.length > 1 ? (
        <section className="card grid gap-6 p-5 md:grid-cols-3">
          {weightSeries.length > 1 ? (
            <MeasurementSparkline label={t('sparklines.weight')} points={weightSeries} unit="kg" />
          ) : null}
          {bodyFatSeries.length > 1 ? (
            <MeasurementSparkline label={t('sparklines.bodyFat')} points={bodyFatSeries} unit="%" />
          ) : null}
          {waistSeries.length > 1 ? (
            <MeasurementSparkline label={t('sparklines.waist')} points={waistSeries} unit="cm" />
          ) : null}
        </section>
      ) : null}

      <AddMeasurementForm canManage={false} selfService />

      {measurements.length === 0 ? (
        <section className="card p-5">
          <p className="muted text-sm">{tAthlete('noMeasurements')}</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {measurements.map((measurement) => {
              const bmi =
                measurement.weight != null && measurement.height != null
                  ? computeBmi(
                      Number(measurement.weight.toString()),
                      Number(measurement.height.toString()),
                    )
                  : null;

              return (
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
                      <dt>{tAthlete('fields.weight')}</dt>
                      <dd className="text-white">{formatDecimal(measurement.weight)} kg</dd>
                    </div>
                    <div>
                      <dt>{tAthlete('fields.bodyFat')}</dt>
                      <dd className="text-white">{formatDecimal(measurement.bodyFatPercentage)}%</dd>
                    </div>
                    <div>
                      <dt>{t('waistCm')}</dt>
                      <dd className="text-white">{formatDecimal(measurement.waistCm)} cm</dd>
                    </div>
                    <div>
                      <dt>{t('columns.bmi')}</dt>
                      <dd className="text-white">{bmi != null ? bmi.toFixed(1) : '—'}</dd>
                    </div>
                    <div>
                      <dt>{tAthlete('fields.muscle')}</dt>
                      <dd className="text-white">{formatDecimal(measurement.muscleMass)} kg</dd>
                    </div>
                    {measurement.notes ? (
                      <div className="col-span-2">
                        <dt>{tAthlete('fields.notes')}</dt>
                        <dd className="text-white">{measurement.notes}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
