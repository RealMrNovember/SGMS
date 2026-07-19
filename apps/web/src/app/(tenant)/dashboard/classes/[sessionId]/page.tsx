import { SessionAttendancePanel } from '@/components/classes/session-attendance-panel';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function ClassSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
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

  const classSession = await prisma.classSession.findFirst({
    where: { id: sessionId, organizationId },
    include: {
      gymClass: { select: { name: true } },
      bookings: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: [{ status: 'asc' }, { waitlistPos: 'asc' }],
        include: { gymMember: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!classSession) {
    notFound();
  }

  const bookings = classSession.bookings.map((b) => ({
    id: b.id,
    status: b.status,
    memberName: `${b.gymMember.firstName} ${b.gymMember.lastName}`,
    waitlistPos: b.waitlistPos,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/classes" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{classSession.gymClass.name}</h2>
        <p className="muted mt-2 text-sm">
          {classSession.startsAt.toLocaleString()} · {classSession.roomName ?? '—'} ·{' '}
          {bookings.filter((b) => b.status === 'BOOKED' || b.status === 'ATTENDED').length}/
          {classSession.capacity}
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('attendanceTitle')}</h3>
        </div>
        <SessionAttendancePanel bookings={bookings} />
      </section>
    </div>
  );
}
