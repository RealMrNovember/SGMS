import { CheckInQrPanel } from '@/components/check-in-qr-panel';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AthleteHomePage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [member, pendingRequest, activeGoalsCount, upcomingEventsCount] = await Promise.all([
    prisma.gymMember.findFirst({
      where: {
        id: session.user.gymMemberId,
        organizationId: session.user.organizationId,
      },
      include: {
        plan: { select: { name: true } },
        trainer: { select: { name: true, email: true } },
        healthMeasurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
        trainingPrograms: { where: { isActive: true }, orderBy: { startDate: 'desc' }, take: 3 },
      },
    }),
    prisma.trainerRequest.findFirst({
      where: { gymMemberId: session.user.gymMemberId, status: 'PENDING' },
      select: { id: true },
    }),
    prisma.athleteGoal.count({
      where: {
        organizationId: session.user.organizationId,
        gymMemberId: session.user.gymMemberId,
        status: 'ACTIVE',
      },
    }),
    prisma.gymEvent.count({
      where: { organizationId: session.user.organizationId, startsAt: { gte: new Date() } },
    }),
  ]);

  if (!member) {
    redirect('/login');
  }

  const unreadMessages = await prisma.directMessage.count({
    where: {
      organizationId: session.user.organizationId,
      receiverId: session.user.id,
      isRead: false,
    },
  });

  const fullName = `${member.firstName} ${member.lastName}`;
  const latestMeasurement = member.healthMeasurements[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex items-center gap-4">
          <UserAvatar name={fullName} avatarUrl={member.avatarUrl} size="lg" />
          <div>
            <h2 className="text-xl font-semibold">{fullName}</h2>
            <p className="muted mt-1 text-sm">
              {member.plan?.name ?? '—'} · <span className="badge">{member.status}</span>
            </p>
            {member.membershipEndsAt ? (
              <p className="muted mt-2 text-xs">
                {t('membershipEnds', {
                  date: member.membershipEndsAt.toLocaleDateString(dateLocale),
                })}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Link href="/athlete/programs" className="card p-4 text-center transition hover:bg-white/5">
          <p className="text-2xl font-semibold">{member.trainingPrograms.length}</p>
          <p className="muted mt-1 text-xs">{t('stats.programs')}</p>
        </Link>
        <Link href="/athlete/measurements" className="card p-4 text-center transition hover:bg-white/5">
          <p className="text-2xl font-semibold">
            {latestMeasurement?.weight?.toString() ?? '—'}
          </p>
          <p className="muted mt-1 text-xs">{t('stats.weight')}</p>
        </Link>
        <Link href="/athlete/messages" className="card p-4 text-center transition hover:bg-white/5">
          <p className="text-2xl font-semibold">{unreadMessages}</p>
          <p className="muted mt-1 text-xs">{t('stats.messages')}</p>
        </Link>
      </section>

      <CheckInQrPanel />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('latestMeasurement')}</h3>
          <Link href="/athlete/measurements" className="muted text-xs hover:text-white">
            {t('viewAll')}
          </Link>
        </div>
        {latestMeasurement ? (
          <dl className="muted grid grid-cols-2 gap-2 px-5 py-4 text-sm">
            <div>
              <dt>{t('fields.date')}</dt>
              <dd className="text-white">
                {latestMeasurement.measuredAt.toLocaleDateString(dateLocale)}
              </dd>
            </div>
            <div>
              <dt>{t('fields.weight')}</dt>
              <dd className="text-white">{latestMeasurement.weight?.toString() ?? '—'} kg</dd>
            </div>
            <div>
              <dt>{t('fields.bodyFat')}</dt>
              <dd className="text-white">
                {latestMeasurement.bodyFatPercentage?.toString() ?? '—'}%
              </dd>
            </div>
            <div>
              <dt>{t('fields.muscle')}</dt>
              <dd className="text-white">{latestMeasurement.muscleMass?.toString() ?? '—'} kg</dd>
            </div>
          </dl>
        ) : (
          <p className="muted px-5 py-4 text-sm">{t('noMeasurements')}</p>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('activePrograms')}</h3>
          <Link href="/athlete/programs" className="muted text-xs hover:text-white">
            {t('viewAll')}
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {member.trainingPrograms.length === 0 ? (
            <p className="muted px-5 py-4 text-sm">{t('noPrograms')}</p>
          ) : (
            member.trainingPrograms.map((program) => (
              <article key={program.id} className="px-5 py-4">
                <p className="font-medium">{program.title}</p>
                <p className="muted text-xs">
                  {program.type} · {program.startDate.toLocaleDateString(dateLocale)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{t('trainer')}</h3>
          {pendingRequest ? <span className="badge text-[10px]">{t('trainerRequestPending')}</span> : null}
        </div>
        <p className="muted mt-2 text-sm">
          {member.trainer?.name ?? member.trainer?.email ?? t('noTrainer')}
        </p>
        <Link href="/athlete/trainers" className="button mt-4 inline-block px-4 py-2 text-sm">
          {t('manageTrainer')}
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/athlete/goals" className="card p-4 transition hover:bg-white/5">
          <p className="font-semibold">{t('goalsCard.title')}</p>
          <p className="muted mt-1 text-xs">
            {activeGoalsCount > 0 ? t('goalsCard.hasActive', { count: activeGoalsCount }) : t('goalsCard.empty')}
          </p>
        </Link>
        <Link href="/athlete/events" className="card p-4 transition hover:bg-white/5">
          <p className="font-semibold">{t('eventsCard.title')}</p>
          <p className="muted mt-1 text-xs">
            {upcomingEventsCount > 0 ? t('eventsCard.hasUpcoming', { count: upcomingEventsCount }) : t('eventsCard.empty')}
          </p>
        </Link>
      </div>

      <p className="muted text-center text-xs leading-5">{t('apiHint')}</p>
    </div>
  );
}
