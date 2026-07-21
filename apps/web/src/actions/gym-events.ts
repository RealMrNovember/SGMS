'use server';

import { isAthleteContext, resolveApiContext } from '@/lib/api/auth-context';
import { auth } from '@/lib/auth';
import { sendPushToUsers } from '@/lib/push/send';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { GymEventType, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const EVENT_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const EVENT_DELETE_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export type GymEventActionState = { error?: string; success?: string };

const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(1000).optional().or(z.literal('')),
  eventType: z.enum(['WALK', 'RUN', 'SPORT', 'OTHER']),
  startsAt: z.string().min(1, 'Tarih/saat gerekli.'),
  location: z.string().max(200).optional().or(z.literal('')),
});

async function getEventStaffContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !EVENT_MANAGER_ROLES.has(role)) {
    return { error: 'Etkinlik oluşturmak için OWNER, ADMIN veya STAFF yetkisi gerekir.' as const };
  }
  return { organizationId, actorId: session.user.id, role };
}

/**
 * Salonun düzenlediği bir motivasyon etkinliği (yürüyüş/koşu/spor) oluşturur ve
 * **tüm aktif üyelere** Faz 27.1'in mevcut Web Push altyapısıyla bildirim
 * gönderir — yeni bir bildirim kanalı icat edilmez.
 */
export async function createGymEvent(
  _prevState: GymEventActionState,
  formData: FormData,
): Promise<GymEventActionState> {
  const context = await getEventStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createEventSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    eventType: formData.get('eventType'),
    startsAt: formData.get('startsAt'),
    location: formData.get('location') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: 'Geçerli bir tarih/saat girin.' };
  }

  const event = await prisma.gymEvent.create({
    data: {
      organizationId: context.organizationId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      eventType: parsed.data.eventType as GymEventType,
      startsAt,
      location: parsed.data.location || null,
      createdById: context.actorId,
    },
  });

  const activeMembers = await prisma.gymMember.findMany({
    where: { organizationId: context.organizationId, status: 'ACTIVE', userId: { not: null } },
    select: { userId: true },
  });
  const userIds = activeMembers.map((m) => m.userId).filter((id): id is string => Boolean(id));

  if (userIds.length > 0) {
    void sendPushToUsers(userIds, {
      title: 'Yeni salon etkinliği',
      body: `${event.title} — ${startsAt.toLocaleDateString('tr-TR')} ${startsAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
      url: '/athlete/events',
      tag: `gym-event-${event.id}`,
    });
  }

  revalidatePath('/dashboard/events');
  return { success: `Etkinlik oluşturuldu, ${userIds.length} üyeye bildirim gönderildi.` };
}

export async function cancelGymEvent(eventId: string): Promise<GymEventActionState> {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !EVENT_DELETE_ROLES.has(role)) {
    return { error: 'Etkinlik silmek için OWNER veya ADMIN yetkisi gerekir.' };
  }

  const event = await prisma.gymEvent.findFirst({ where: { id: eventId, organizationId } });
  if (!event) {
    return { error: 'Etkinlik bulunamadı.' };
  }

  await prisma.gymEvent.delete({ where: { id: event.id } });
  revalidatePath('/dashboard/events');
  return { success: 'Etkinlik silindi.' };
}

/** Sporcu (web veya mobil) etkinliğe katılım bildirir/iptal eder. */
export async function rsvpToGymEvent(
  eventId: string,
  going: boolean,
  request?: Request,
): Promise<GymEventActionState> {
  const result = await resolveApiContext(request);
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  const { organizationId, gymMemberId } = result.context;

  const event = await prisma.gymEvent.findFirst({ where: { id: eventId, organizationId } });
  if (!event) {
    return { error: 'Etkinlik bulunamadı.' };
  }

  await prisma.gymEventRsvp.upsert({
    where: { gymEventId_gymMemberId: { gymEventId: eventId, gymMemberId } },
    create: {
      organizationId,
      gymEventId: eventId,
      gymMemberId,
      status: going ? 'GOING' : 'CANCELLED',
    },
    update: { status: going ? 'GOING' : 'CANCELLED' },
  });

  revalidatePath('/dashboard/events');
  revalidatePath('/athlete/events');
  return { success: going ? 'Katılımın kaydedildi.' : 'Katılımın iptal edildi.' };
}
