import { PtSessionActions } from '@/components/trainers/pt-session-actions';
import { ScheduleSessionForm } from '@/components/trainers/schedule-session-form';
import { TrainerCommissionForm } from '@/components/trainers/trainer-commission-form';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getTrainerMonthlyStats } from '@/lib/trainers/queries';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
const VIEWER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const isSelf = session.user.id === id;

  if (role === 'TRAINER' && !isSelf) {
    redirect(`/dashboard/trainers/${session.user.id}`);
  }
  if (role && !VIEWER_ROLES.has(role) && !isSelf) {
    redirect('/dashboard');
  }

  const t = await getTranslations('trainers');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const canSchedule = role ? (['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] as OrganizationRole[]).includes(role) : false;

  const [membership, profile, stats, sessions, gymMembersForForm] = await Promise.all([
    prisma.organizationMember.findFirst({
      where: { organizationId, userId: id, role: 'TRAINER', isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId, userId: id } },
    }),
    getTrainerMonthlyStats(organizationId, id),
    prisma.ptSession.findMany({
      where: { organizationId, trainerUserId: id },
      include: { gymMember: { select: { firstName: true, lastName: true } } },
      orderBy: { scheduledAt: 'desc' },
      take: 30,
    }),
    canSchedule
      ? prisma.gymMember.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: 'asc' },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  if (!membership) {
    notFound();
  }

  const canManageProfile = role ? MANAGER_ROLES.has(role) : false;
  const monthLabel = new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-6">
      <Link href="/dashboard/trainers" className="muted text-sm hover:text-white">
        ← {t('title')}
      </Link>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">{membership.user.name}</h2>
        <p className="muted mt-1 text-sm">{membership.user.email}</p>
        <p className="muted mt-1 text-xs">{monthLabel}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="muted text-xs">{t('kpi.sessions')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.sessionCount}</p>
          </div>
          <div>
            <p className="muted text-xs">{t('kpi.hours')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.hoursWorked}</p>
          </div>
          <div>
            <p className="muted text-xs">{t('kpi.revenue')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.grossRevenue.toLocaleString(dateLocale)} ₺</p>
          </div>
          <div>
            <p className="muted text-xs">{t('kpi.commission')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#c9a962]">
              {stats.totalCommission.toLocaleString(dateLocale)} ₺
            </p>
          </div>
          <div>
            <p className="muted text-xs">{t('kpi.canceled')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.canceledCount}</p>
          </div>
          <div>
            <p className="muted text-xs">{t('kpi.noShowRate')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stats.noShowRate}%</p>
          </div>
        </div>
      </section>

      {canManageProfile ? (
        <TrainerCommissionForm
          trainerUserId={id}
          currentModel={profile?.commissionModel ?? 'FIXED_PER_SESSION'}
          currentBaseRate={profile ? Number(profile.baseCommissionRate) : 0}
          currentHourlyRate={profile?.hourlyRate ? Number(profile.hourlyRate) : null}
        />
      ) : !profile ? (
        <div className="card p-5 text-sm">
          <p className="muted">{t('noProfileHint')}</p>
        </div>
      ) : null}

      {canSchedule ? (
        <ScheduleSessionForm
          trainerUserId={id}
          members={gymMembersForForm.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }))}
        />
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="font-semibold">{t('sessions.title')}</h3>
        </div>
        {sessions.length === 0 ? (
          <p className="muted p-6 text-sm">{t('sessions.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 font-medium">{t('sessions.colDate')}</th>
                  <th className="px-6 py-3 font-medium">{t('sessions.colMember')}</th>
                  <th className="px-6 py-3 font-medium">{t('sessions.colDuration')}</th>
                  <th className="px-6 py-3 font-medium">{t('sessions.colStatus')}</th>
                  <th className="px-6 py-3 font-medium">{t('sessions.colRevenue')}</th>
                  <th className="px-6 py-3 font-medium">{t('sessions.colCommission')}</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-3">{s.scheduledAt.toLocaleString(dateLocale)}</td>
                    <td className="px-6 py-3">
                      {s.gymMember.firstName} {s.gymMember.lastName}
                    </td>
                    <td className="px-6 py-3">{s.durationMinutes} dk</td>
                    <td className="px-6 py-3">
                      <span className="badge text-[10px]">{t(`sessions.status.${s.status}`)}</span>
                    </td>
                    <td className="px-6 py-3 tabular-nums">
                      {s.revenueAmount ? `${Number(s.revenueAmount).toLocaleString(dateLocale)} ₺` : '—'}
                    </td>
                    <td className="px-6 py-3 tabular-nums text-[#c9a962]">
                      {s.commissionAmount ? `${Number(s.commissionAmount).toLocaleString(dateLocale)} ₺` : '—'}
                    </td>
                    <td className="px-6 py-3">
                      {s.status === 'SCHEDULED' ? <PtSessionActions sessionId={s.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
