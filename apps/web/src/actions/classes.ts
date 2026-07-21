'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { ClassBookingStatus, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type ClassActionState = {
  error?: string;
  success?: string;
};

const STAFF_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

async function getManagerContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }
  return { organizationId, actorId: session.user.id, role };
}

async function getBookingContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için oturum gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId) {
    return { error: 'Organizasyon bulunamadı.' as const };
  }
  if (role && STAFF_ROLES.has(role)) {
    return { organizationId, actorId: session.user.id, isStaff: true as const };
  }
  if (session.user.gymMemberId) {
    return {
      organizationId,
      actorId: session.user.id,
      isStaff: false as const,
      gymMemberId: session.user.gymMemberId,
    };
  }
  return { error: 'Bu işlem için yetkiniz yok.' as const };
}

function parseWeeklyDays(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function parseStartTime(time: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

const createClassSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  trainerId: z.string().cuid().optional(),
  roomName: z.string().max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(500),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  weeklyDays: z.string().min(1),
  startTime: z.string().min(4).max(5),
});

export async function createGymClass(
  _prev: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const context = await getManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const weeklyDaysRaw = String(formData.get('weeklyDays') ?? '');
  const checkboxDays = formData.getAll('weeklyDay').map((v) => Number(v));
  const weeklyDays =
    checkboxDays.length > 0
      ? checkboxDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : parseWeeklyDays(weeklyDaysRaw);

  const parsed = createClassSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    trainerId: formData.get('trainerId') || undefined,
    roomName: formData.get('roomName') || undefined,
    capacity: formData.get('capacity') ?? 15,
    durationMinutes: formData.get('durationMinutes') ?? 60,
    weeklyDays: weeklyDays.join(','),
    startTime: formData.get('startTime'),
  });

  if (!parsed.success || weeklyDays.length === 0) {
    return { error: 'Ders bilgilerini ve haftalık günleri kontrol edin.' };
  }

  const startParts = parseStartTime(parsed.data.startTime);
  if (!startParts) {
    return { error: 'Başlangıç saati HH:mm formatında olmalı.' };
  }

  if (parsed.data.trainerId) {
    const trainer = await prisma.organizationMember.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: parsed.data.trainerId,
        isActive: true,
        role: { in: ['TRAINER', 'OWNER', 'ADMIN', 'STAFF'] },
      },
    });
    if (!trainer) {
      return { error: 'Seçilen antrenör bulunamadı.' };
    }
  }

  const gymClass = await prisma.$transaction(async (tx) => {
    const created = await tx.gymClass.create({
      data: {
        organizationId: context.organizationId,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        trainerId: parsed.data.trainerId ?? null,
        roomName: parsed.data.roomName?.trim() || null,
        capacity: parsed.data.capacity,
        durationMinutes: parsed.data.durationMinutes,
        weeklyDays,
        startTime: parsed.data.startTime,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'CLASS_CREATED',
        entityType: 'gym_class',
        entityId: created.id,
        metadata: { name: created.name, weeklyDays },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/classes');
  return { success: `"${gymClass.name}" dersi oluşturuldu.` };
}

export async function generateClassSessions(
  classId: string,
  weeksAhead = 4,
): Promise<ClassActionState> {
  const context = await getManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const gymClass = await prisma.gymClass.findFirst({
    where: { id: classId, organizationId: context.organizationId, isActive: true },
  });
  if (!gymClass) {
    return { error: 'Ders bulunamadı.' };
  }

  const startParts = parseStartTime(gymClass.startTime);
  if (!startParts) {
    return { error: 'Ders başlangıç saati geçersiz.' };
  }

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + weeksAhead * 7);

  let created = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= horizon) {
    if (gymClass.weeklyDays.includes(cursor.getDay())) {
      const startsAt = new Date(cursor);
      startsAt.setHours(startParts.hours, startParts.minutes, 0, 0);
      if (startsAt >= now) {
        const endsAt = new Date(startsAt.getTime() + gymClass.durationMinutes * 60_000);
        try {
          await prisma.classSession.create({
            data: {
              organizationId: context.organizationId,
              gymClassId: gymClass.id,
              startsAt,
              endsAt,
              capacity: gymClass.capacity,
              trainerId: gymClass.trainerId,
              roomName: gymClass.roomName,
            },
          });
          created += 1;
        } catch {
          // unique [gymClassId, startsAt] — zaten var
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (created > 0) {
    await prisma.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'CLASS_SESSION_UPDATED',
        entityType: 'gym_class',
        entityId: gymClass.id,
        metadata: { generated: created, weeksAhead },
      },
    });
  }

  revalidatePath('/dashboard/classes');
  return { success: `${created} seans oluşturuldu.` };
}

export async function bookClassSession(
  sessionId: string,
  gymMemberId?: string,
): Promise<ClassActionState> {
  const context = await getBookingContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const memberId = context.isStaff ? gymMemberId : context.gymMemberId;
  if (!memberId) {
    return { error: 'Üye seçimi gerekli.' };
  }

  if (!context.isStaff && gymMemberId && gymMemberId !== context.gymMemberId) {
    return { error: 'Yalnızca kendiniz için rezervasyon yapabilirsiniz.' };
  }

  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      organizationId: context.organizationId,
      isCancelled: false,
      startsAt: { gt: new Date() },
    },
    include: { _count: { select: { bookings: { where: { status: 'BOOKED' } } } } },
  });
  if (!session) {
    return { error: 'Seans bulunamadı veya geçmiş.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: memberId, organizationId: context.organizationId, status: 'ACTIVE' },
  });
  if (!member) {
    return { error: 'Aktif üye bulunamadı.' };
  }

  const existing = await prisma.classBooking.findUnique({
    where: { classSessionId_gymMemberId: { classSessionId: sessionId, gymMemberId: memberId } },
  });
  if (existing && existing.status !== 'CANCELLED') {
    return { error: 'Bu seansa zaten kayıtlısınız.' };
  }

  const bookedCount = session._count.bookings;
  const isFull = bookedCount >= session.capacity;

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.classBooking.update({
        where: { id: existing.id },
        data: {
          status: isFull ? 'WAITLISTED' : 'BOOKED',
          waitlistPos: isFull
            ? (await tx.classBooking.count({
                where: { classSessionId: sessionId, status: 'WAITLISTED' },
              })) + 1
            : null,
          cancelledAt: null,
          createdById: context.actorId,
        },
      });
    } else {
      await tx.classBooking.create({
        data: {
          organizationId: context.organizationId,
          classSessionId: sessionId,
          gymMemberId: memberId,
          status: isFull ? 'WAITLISTED' : 'BOOKED',
          waitlistPos: isFull
            ? (await tx.classBooking.count({
                where: { classSessionId: sessionId, status: 'WAITLISTED' },
              })) + 1
            : null,
          createdById: context.actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'CLASS_BOOKING_CREATED',
        entityType: 'class_booking',
        entityId: sessionId,
        metadata: { gymMemberId: memberId, waitlisted: isFull },
      },
    });
  });

  revalidatePath('/dashboard/classes');
  revalidatePath(`/dashboard/classes/${sessionId}`);
  revalidatePath('/athlete/classes');
  return { success: isFull ? 'Bekleme listesine alındınız.' : 'Rezervasyon oluşturuldu.' };
}

export async function cancelClassBooking(bookingId: string): Promise<ClassActionState> {
  const context = await getBookingContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const booking = await prisma.classBooking.findFirst({
    where: { id: bookingId, organizationId: context.organizationId },
    include: { classSession: true },
  });
  if (!booking) {
    return { error: 'Rezervasyon bulunamadı.' };
  }

  if (!context.isStaff && booking.gymMemberId !== context.gymMemberId) {
    return { error: 'Bu rezervasyonu iptal edemezsiniz.' };
  }

  if (booking.status === 'CANCELLED') {
    return { error: 'Rezervasyon zaten iptal.' };
  }

  const wasBooked = booking.status === 'BOOKED';

  await prisma.$transaction(async (tx) => {
    await tx.classBooking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), waitlistPos: null },
    });

    if (wasBooked) {
      const next = await tx.classBooking.findFirst({
        where: { classSessionId: booking.classSessionId, status: 'WAITLISTED' },
        orderBy: { waitlistPos: 'asc' },
      });
      if (next) {
        await tx.classBooking.update({
          where: { id: next.id },
          data: { status: 'BOOKED', waitlistPos: null, promotedAt: new Date() },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'CLASS_BOOKING_CANCELLED',
        entityType: 'class_booking',
        entityId: booking.id,
        metadata: { classSessionId: booking.classSessionId },
      },
    });
  });

  revalidatePath('/dashboard/classes');
  revalidatePath(`/dashboard/classes/${booking.classSessionId}`);
  revalidatePath('/athlete/classes');
  return { success: 'Rezervasyon iptal edildi.' };
}

export async function markAttendance(
  bookingId: string,
  status: Extract<ClassBookingStatus, 'ATTENDED' | 'NO_SHOW'>,
): Promise<ClassActionState> {
  const context = await getManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const booking = await prisma.classBooking.findFirst({
    where: {
      id: bookingId,
      organizationId: context.organizationId,
      status: { in: ['BOOKED', 'ATTENDED', 'NO_SHOW'] },
    },
  });
  if (!booking) {
    return { error: 'Rezervasyon bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.classBooking.update({
      where: { id: booking.id },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'CLASS_ATTENDANCE_MARKED',
        entityType: 'class_booking',
        entityId: booking.id,
        metadata: { status, classSessionId: booking.classSessionId },
      },
    });
  });

  revalidatePath(`/dashboard/classes/${booking.classSessionId}`);
  return { success: status === 'ATTENDED' ? 'Katılım işaretlendi.' : 'Gelmedi olarak işaretlendi.' };
}
