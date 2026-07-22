import { AddMeasurementForm } from '@/components/add-measurement-form';
import { MeasurementSparkline } from '@/components/measurement-sparkline';
import { UploadMeasurementPhotoForm } from '@/components/upload-measurement-photo-form';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { trainerScopedMemberWhere } from '@/lib/trainers/member-scope';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

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
    where: {
      id,
      organizationId,
      ...trainerScopedMemberWhere(role, session.user.id),
    },
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

  const [measurements, photos] = await Promise.all([
    prisma.healthMeasurement.findMany({
      where: { organizationId, gymMemberId: id },
      orderBy: { measuredAt: 'desc' },
      take: 50,
    }),
    prisma.measurementPhoto.findMany({
      where: { organizationId, gymMemberId: id },
      orderBy: { takenAt: 'desc' },
      take: 24,
    }),
  ]);

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

      {weightSeries.length > 1 || bodyFatSeries.length > 1 || waistSeries.length > 1 ? (
        <section className="card grid gap-6 p-6 md:grid-cols-3">
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

      <AddMeasurementForm gymMemberId={id} canManage={canManage} />

      <UploadMeasurementPhotoForm gymMemberId={id} canManage={canManage} />

      {photos.length > 0 ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">{t('photoGalleryTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('photoGalleryCount', { count: photos.length })}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {photos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="relative aspect-[3/4] bg-black/20">
                  <Image
                    src={photo.photoUrl}
                    alt={t('photoAngles.' + photo.angle.toLowerCase())}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
                  />
                </div>
                <figcaption className="px-3 py-2 text-xs">
                  <span className="font-medium">{t(`photoAngles.${photo.angle.toLowerCase()}`)}</span>
                  <span className="muted block">
                    {photo.takenAt.toLocaleDateString(dateLocale)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('historyTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('recordCount', { count: measurements.length })}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{t('columns.date')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.weight')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.bodyFat')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.waist')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.muscle')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.height')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {measurements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted px-6 py-8 text-center">
                    {t('emptyShort')}
                  </td>
                </tr>
              ) : (
                measurements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">{m.measuredAt.toLocaleString(dateLocale)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.weight)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.bodyFatPercentage)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.waistCm)}</td>
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
