import {
  EquipmentMaintenanceForm,
  EquipmentQrBanner,
  EquipmentReportIssueForm,
  EquipmentServiceLogForm,
  EquipmentStatusSelect,
  MaintenanceDoneButton,
} from '@/components/equipment/equipment-forms';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qr?: string; publicCode?: string }>;
};

function warrantyLabel(warrantyExpiresAt: Date | null, t: (key: string) => string): string {
  if (!warrantyExpiresAt) return t('warrantyUnknown');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(warrantyExpiresAt);
  expiry.setHours(0, 0, 0, 0);
  if (expiry >= today) return t('warrantyActive');
  return t('warrantyExpired');
}

export default async function EquipmentDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const query = await searchParams;
  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz23');

  const equipment = await prisma.gymEquipment.findFirst({
    where: { id, organizationId },
    include: {
      serviceLogs: {
        orderBy: { reportedAt: 'desc' },
        include: { reportedBy: { select: { name: true } } },
      },
      schedules: { where: { isActive: true }, orderBy: { nextDueDate: 'asc' } },
    },
  });

  if (!equipment) {
    notFound();
  }

  const lastService = equipment.serviceLogs[0]?.reportedAt ?? null;
  const nextMaintenance = equipment.schedules[0]?.nextDueDate ?? null;
  const showQr = query.qr && query.publicCode;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/equipment" className="muted text-sm hover:text-white">
          {t('backToList')}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{equipment.name}</h2>
            <p className="muted mt-2 text-sm">
              {t(`categories.${equipment.category}`)} · {t('publicCodeLabel')}: {equipment.publicCode}
              {equipment.location ? ` · ${equipment.location}` : ''}
            </p>
          </div>
          {equipment.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={equipment.photoUrl}
              alt={equipment.name}
              className="h-24 w-24 rounded-xl border border-[var(--border)] object-cover"
            />
          ) : null}
        </div>
      </div>

      {showQr ? <EquipmentQrBanner qrToken={query.qr!} publicCode={query.publicCode!} /> : null}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="muted text-xs">{t('warrantyStatus')}</p>
          <p className="mt-2 font-medium">{warrantyLabel(equipment.warrantyExpiresAt, t)}</p>
          {equipment.warrantyExpiresAt ? (
            <p className="muted mt-1 text-xs">{equipment.warrantyExpiresAt.toLocaleDateString()}</p>
          ) : null}
        </div>
        <div className="card p-4">
          <p className="muted text-xs">{t('lastService')}</p>
          <p className="mt-2 font-medium">
            {lastService ? lastService.toLocaleDateString() : t('noServiceYet')}
          </p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs">{t('nextMaintenance')}</p>
          <p className="mt-2 font-medium">
            {nextMaintenance ? nextMaintenance.toLocaleDateString() : t('noMaintenanceScheduled')}
          </p>
        </div>
        <div className="card p-4">
          <EquipmentStatusSelect equipmentId={equipment.id} currentStatus={equipment.status} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <EquipmentReportIssueForm equipmentId={equipment.id} />
        <EquipmentServiceLogForm equipmentId={equipment.id} />
      </div>

      <EquipmentMaintenanceForm equipmentId={equipment.id} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('maintenancePlansTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {equipment.schedules.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('noMaintenanceScheduled')}</p>
          ) : (
            equipment.schedules.map((schedule) => (
              <article key={schedule.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{schedule.title}</p>
                  <p className="muted text-sm">
                    {t(`frequencies.${schedule.frequency}`)} · {t('nextDueDate')}:{' '}
                    {schedule.nextDueDate.toLocaleDateString()}
                    {schedule.lastDoneAt ? ` · ${t('lastDoneAt')}: ${schedule.lastDoneAt.toLocaleDateString()}` : ''}
                  </p>
                  {schedule.notes ? <p className="muted mt-1 text-xs italic">{schedule.notes}</p> : null}
                </div>
                <MaintenanceDoneButton scheduleId={schedule.id} />
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('serviceHistoryTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {equipment.serviceLogs.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('noServiceYet')}</p>
          ) : (
            equipment.serviceLogs.map((log) => (
              <article key={log.id} className="space-y-1 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{log.reportedAt.toLocaleString()}</p>
                  <p className="muted text-xs">{log.reportedBy.name}</p>
                </div>
                <p className="text-sm">{log.issueDescription}</p>
                <p className="muted text-xs">
                  {log.serviceProvider ? `${log.serviceProvider} · ` : ''}
                  {log.serviceDate ? log.serviceDate.toLocaleDateString() : t('noServiceDate')}
                  {log.cost != null ? ` · ${Number(log.cost).toFixed(2)} TRY` : ''}
                  {log.warrantyClaim ? ` · ${t('warrantyClaim')}` : ''}
                </p>
                {log.photoUrl ? (
                  <a href={log.photoUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">
                    {t('viewPhoto')}
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card space-y-2 p-6">
        <h3 className="text-lg font-semibold">{t('purchaseInfoTitle')}</h3>
        <p className="muted text-sm">
          {equipment.serialNumber ? `${t('serialNumber')}: ${equipment.serialNumber} · ` : ''}
          {equipment.purchaseDate ? `${t('purchaseDate')}: ${equipment.purchaseDate.toLocaleDateString()} · ` : ''}
          {equipment.purchasePrice != null
            ? `${t('purchasePrice')}: ${Number(equipment.purchasePrice).toFixed(2)} TRY`
            : ''}
        </p>
        <p className="muted text-xs">
          {t('scanHint')}: /dashboard/equipment/scan/{equipment.publicCode}
        </p>
      </section>
    </div>
  );
}
