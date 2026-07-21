import { GymEventPanel } from '@/components/gym-event-panel';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const EVENT_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const EVENT_DELETE_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export default async function GymEventsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const canManage = role ? EVENT_MANAGER_ROLES.has(role) : false;
  const canDelete = role ? EVENT_DELETE_ROLES.has(role) : false;

  const t = await getTranslations('events');

  const events = await prisma.gymEvent.findMany({
    where: { organizationId, startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    include: { _count: { select: { rsvps: { where: { status: 'GOING' } } } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <GymEventPanel
        canManage={canManage}
        canDelete={canDelete}
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          startsAt: event.startsAt.toISOString(),
          location: event.location,
          goingCount: event._count.rsvps,
        }))}
      />
    </div>
  );
}
