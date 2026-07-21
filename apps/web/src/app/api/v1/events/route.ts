import { requireAthleteApiContext } from '@/lib/api/guard';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

/**
 * Faz 39 — mobil "Etkinlikler". Sporcunun salonundaki yaklaşan etkinlikleri
 * ve kendi RSVP durumunu listeler.
 */
export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  const events = await prisma.gymEvent.findMany({
    where: { organizationId, startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    include: {
      rsvps: { where: { gymMemberId }, select: { status: true } },
      _count: { select: { rsvps: { where: { status: 'GOING' } } } },
    },
  });

  return apiOk({
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      startsAt: event.startsAt.toISOString(),
      location: event.location,
      goingCount: event._count.rsvps,
      myStatus: event.rsvps[0]?.status ?? null,
    })),
  });
}
