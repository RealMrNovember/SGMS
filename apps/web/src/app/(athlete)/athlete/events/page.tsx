import { AthleteEventList } from '@/components/athlete-event-list';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteEventsPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete.events');
  const tAthlete = await getTranslations('athlete');
  const { organizationId, gymMemberId } = session.user;

  const events = await prisma.gymEvent.findMany({
    where: { organizationId, startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    include: {
      rsvps: { where: { gymMemberId }, select: { status: true } },
      _count: { select: { rsvps: { where: { status: 'GOING' } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {tAthlete('backHome')}
        </Link>
        <h2 className="mt-4 text-xl font-semibold">{t('title')}</h2>
      </div>

      <AthleteEventList
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          startsAt: event.startsAt.toISOString(),
          location: event.location,
          goingCount: event._count.rsvps,
          myStatus: event.rsvps[0]?.status ?? null,
        }))}
      />
    </div>
  );
}
