import { AthleteClassBookingList } from '@/components/classes/athlete-class-list';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteClassesPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const gymMemberId = session.user.gymMemberId;
  const t = await getTranslations('faz17.classes');

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const [sessions, myBookings] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        organizationId,
        isCancelled: false,
        startsAt: { gte: now, lte: horizon },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        gymClass: { select: { name: true } },
        _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
      },
    }),
    prisma.classBooking.findMany({
      where: { organizationId, gymMemberId, status: { not: 'CANCELLED' } },
      select: { id: true, classSessionId: true, status: true },
    }),
  ]);

  const bookingsBySession = Object.fromEntries(
    myBookings.map((b) => [b.classSessionId, { id: b.id, status: b.status }]),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          ← {t('athleteBack')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{t('athleteTitle')}</h2>
        <p className="muted mt-2 text-sm">{t('athleteSubtitle')}</p>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('upcoming')}</h3>
        </div>
        <AthleteClassBookingList
          sessions={sessions.map((s) => ({
            id: s.id,
            startsAt: s.startsAt.toISOString(),
            className: s.gymClass.name,
            roomName: s.roomName,
            bookedCount: s._count.bookings,
            capacity: s.capacity,
          }))}
          bookingsBySession={bookingsBySession}
        />
      </section>
    </div>
  );
}
