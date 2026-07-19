import {
  CompensationSection,
  DisciplinaryRecordForm,
  PerformanceReviewForm,
} from '@/components/hr/admin-forms';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const HR_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function HrDashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !HR_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const isAdmin = ADMIN_ROLES.has(role);
  const t = await getTranslations('faz22');

  const today = startOfDay();
  const todayDayOfWeek = today.getDay();

  const [pendingLeaves, onLeaveToday, todayShifts, staffMembers] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        ...(isAdmin ? {} : { userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        organizationId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { startDate: 'asc' },
      take: 20,
    }),
    prisma.shift.findMany({
      where: {
        organizationId,
        isActive: true,
        dayOfWeek: todayDayOfWeek,
        ...(isAdmin
          ? {}
          : {
              assignments: { some: { userId } },
            }),
      },
      include: {
        assignments: {
          include: { user: { select: { name: true, email: true } } },
          ...(isAdmin ? {} : { where: { userId } }),
        },
      },
      orderBy: { startTime: 'asc' },
    }),
    isAdmin
      ? prisma.organizationMember.findMany({
          where: {
            organizationId,
            isActive: true,
            role: { in: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const staffOptions = staffMembers.map((m) => ({
    id: m.user.id,
    label: m.user.name ?? m.user.email,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="card p-5">
          <p className="muted text-sm">{t('stats.pendingLeaves')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{pendingLeaves.length}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('stats.onLeaveToday')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{onLeaveToday.length}</p>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('stats.onShiftToday')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{todayShifts.length}</p>
        </article>
      </section>

      <section className="card p-6">
        <h3 className="text-lg font-semibold">{t('quickLinks')}</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/hr/leaves" className="button py-2 text-sm">
            {t('links.leaves')}
          </Link>
          <Link href="/dashboard/hr/shifts" className="button-outline-gold py-2 text-sm">
            {t('links.shifts')}
          </Link>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('pendingLeavesTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {pendingLeaves.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('pendingLeavesEmpty')}</p>
          ) : (
            pendingLeaves.map((leave) => (
              <article key={leave.id} className="px-6 py-4">
                <p className="font-medium">{leave.user.name ?? leave.user.email}</p>
                <p className="muted text-sm">
                  {leave.startDate.toLocaleDateString()} → {leave.endDate.toLocaleDateString()} ·{' '}
                  {leave.type}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('onLeaveTodayTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {onLeaveToday.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('onLeaveTodayEmpty')}</p>
          ) : (
            onLeaveToday.map((leave) => (
              <article key={leave.id} className="px-6 py-4">
                <p className="font-medium">{leave.user.name ?? leave.user.email}</p>
                <p className="muted text-sm">
                  {leave.startDate.toLocaleDateString()} → {leave.endDate.toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('onShiftTodayTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {todayShifts.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('onShiftTodayEmpty')}</p>
          ) : (
            todayShifts.map((shift) => (
              <article key={shift.id} className="px-6 py-4">
                <p className="font-medium">
                  {shift.name} · {shift.startTime}–{shift.endTime}
                </p>
                <p className="muted text-sm">
                  {shift.assignments.length > 0
                    ? shift.assignments.map((a) => a.user.name ?? a.user.email).join(', ')
                    : t('unassignedShift')}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {isAdmin ? (
        <>
          <PerformanceReviewForm staff={staffOptions} />
          <DisciplinaryRecordForm staff={staffOptions} />
          <CompensationSection
            members={staffMembers.map((m) => ({
              id: m.id,
              userId: m.user.id,
              label: m.user.name ?? m.user.email,
              role: m.role,
              baseSalary: m.baseSalary?.toString() ?? '',
              bonusSummary: m.bonusSummary ?? '',
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
