import { ClassCreateForm, GenerateSessionsButton } from '@/components/classes/class-forms';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz17.classes');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [classes, trainers, todaySessions] = await Promise.all([
    prisma.gymClass.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { sessions: true } } },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, role: { in: ['TRAINER', 'STAFF', 'ADMIN', 'OWNER'] } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.classSession.findMany({
      where: {
        organizationId,
        startsAt: { gte: todayStart, lt: todayEnd },
        isCancelled: false,
      },
      orderBy: { startsAt: 'asc' },
      include: {
        gymClass: { select: { name: true } },
        bookings: {
          where: { status: { in: ['BOOKED', 'WAITLISTED', 'ATTENDED'] } },
          include: { gymMember: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <ClassCreateForm
        trainers={trainers.map((m) => ({ id: m.user.id, name: m.user.name }))}
      />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('classList')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {classes.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('noClasses')}</p>
          ) : (
            classes.map((gymClass) => (
              <article key={gymClass.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{gymClass.name}</p>
                  <p className="muted text-sm">
                    {gymClass.startTime} · {gymClass.capacity} {t('capacityLabel')} ·{' '}
                    {gymClass._count.sessions} {t('sessions')}
                  </p>
                </div>
                <GenerateSessionsButton classId={gymClass.id} />
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('todaySessions')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {todaySessions.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('noToday')}</p>
          ) : (
            todaySessions.map((session) => (
              <article key={session.id} className="px-6 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/dashboard/classes/${session.id}`} className="font-medium hover:underline">
                      {session.gymClass.name}
                    </Link>
                    <p className="muted text-sm">
                      {session.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {session._count.bookings}/{session.capacity} {t('booked')}
                    </p>
                  </div>
                  <Link href={`/dashboard/classes/${session.id}`} className="muted text-sm hover:text-white">
                    {t('attendanceLink')}
                  </Link>
                </div>
                {session.bookings.length > 0 ? (
                  <ul className="muted mt-2 space-y-1 text-xs">
                    {session.bookings.slice(0, 5).map((b) => (
                      <li key={b.id}>
                        {b.gymMember.firstName} {b.gymMember.lastName} · {b.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
