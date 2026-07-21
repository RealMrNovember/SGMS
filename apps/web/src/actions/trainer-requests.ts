'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push/send';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole, TrainerRequestStatus, TrainerRequestType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type TrainerRequestActionState = {
  error?: string;
  success?: string;
};

const ADMIN_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
const REQUEST_TYPES = ['ASSIGN', 'CHANGE', 'REMOVE'] as const satisfies readonly TrainerRequestType[];
const DECISIONS = ['APPROVE', 'REJECT'] as const;

async function getStaffContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !ADMIN_ROLES.has(role)) {
    return { error: 'Bu işlem için OWNER veya ADMIN yetkisi gerekir.' as const };
  }
  return { organizationId, actorId: session.user.id, role };
}

async function getMemberOrStaffContext(gymMemberId?: string) {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için oturum gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId) {
    return { error: 'Organizasyon bulunamadı.' as const };
  }
  if (role && MANAGER_ROLES.has(role)) {
    return { organizationId, actorId: session.user.id, isStaff: true as const };
  }
  if (session.user.gymMemberId && (!gymMemberId || session.user.gymMemberId === gymMemberId)) {
    return {
      organizationId,
      actorId: session.user.id,
      isStaff: false as const,
      gymMemberId: session.user.gymMemberId,
    };
  }
  return { error: 'Bu işlem için yetkiniz yok.' as const };
}

async function getBioEditContext(trainerUserId: string) {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role) {
    return { error: 'Organizasyon bulunamadı.' as const };
  }
  const isSelf = session.user.id === trainerUserId;
  if (!ADMIN_ROLES.has(role) && !(role === 'TRAINER' && isSelf)) {
    return { error: 'Bu profili düzenleme yetkiniz yok.' as const };
  }
  return { organizationId, actorId: session.user.id, trainerUserId };
}

const requestSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  preferredTrainerId: z.string().cuid().optional(),
  reason: z.string().max(2000).optional(),
  gymMemberId: z.string().cuid().optional(),
});

export async function requestTrainerChange(input: {
  requestType: TrainerRequestType;
  preferredTrainerId?: string;
  reason?: string;
  gymMemberId?: string;
}): Promise<TrainerRequestActionState> {
  const context = await getMemberOrStaffContext(input.gymMemberId);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Geçersiz talep bilgisi.' };
  }

  const targetMemberId = context.isStaff ? parsed.data.gymMemberId : context.gymMemberId;
  if (!targetMemberId) {
    return { error: 'Üye seçimi gerekli.' };
  }
  if (!context.isStaff && targetMemberId !== context.gymMemberId) {
    return { error: 'Yalnızca kendi üyeliğiniz için talep oluşturabilirsiniz.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: targetMemberId, organizationId: context.organizationId, status: 'ACTIVE' },
  });
  if (!member) {
    return { error: 'Aktif üye bulunamadı.' };
  }

  if (parsed.data.requestType === 'ASSIGN' && member.trainerId) {
    return { error: 'Bu üyenin zaten atanmış bir antrenörü var — değişiklik talebi kullanın.' };
  }
  if (parsed.data.requestType === 'CHANGE' && !member.trainerId) {
    return { error: 'Değişiklik talebi için mevcut bir antrenör gerekir.' };
  }
  if (parsed.data.requestType === 'REMOVE' && !member.trainerId) {
    return { error: 'Kaldırılacak atanmış antrenör yok.' };
  }

  if (parsed.data.preferredTrainerId) {
    const preferred = await prisma.organizationMember.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: parsed.data.preferredTrainerId,
        role: 'TRAINER',
        isActive: true,
      },
    });
    if (!preferred) {
      return { error: 'Seçilen antrenör bulunamadı.' };
    }
  }

  const pending = await prisma.trainerRequest.findFirst({
    where: { gymMemberId: member.id, status: 'PENDING' },
  });
  if (pending) {
    return { error: 'Bu üye için bekleyen bir antrenör talebi zaten var.' };
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.trainerRequest.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: member.id,
        requestType: parsed.data.requestType,
        preferredTrainerId: parsed.data.preferredTrainerId ?? null,
        reason: parsed.data.reason?.trim() || null,
        status: 'PENDING',
        requestedById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'trainer_request',
        entityId: row.id,
        metadata: {
          kind: 'trainer_request_created',
          gymMemberId: member.id,
          requestType: parsed.data.requestType,
        },
      },
    });

    return row;
  });

  revalidatePath('/dashboard/trainer-requests');
  revalidatePath('/athlete/trainers');
  revalidatePath('/athlete');
  return { success: `Antrenör talebi oluşturuldu (${created.id.slice(0, 8)}…).` };
}

const reviewSchema = z.object({
  requestId: z.string().cuid(),
  decision: z.enum(DECISIONS),
  resultingTrainerId: z.string().cuid().optional(),
});

export async function reviewTrainerRequest(input: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT';
  resultingTrainerId?: string;
}): Promise<TrainerRequestActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock && input.decision === 'APPROVE') {
    return { error: writeBlock };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Geçersiz karar bilgisi.' };
  }

  const request = await prisma.trainerRequest.findFirst({
    where: { id: parsed.data.requestId, organizationId: context.organizationId, status: 'PENDING' },
    include: {
      gymMember: {
        include: {
          user: { select: { id: true } },
          trainer: { select: { id: true, name: true } },
        },
      },
      preferredTrainer: { select: { id: true, name: true } },
    },
  });
  if (!request) {
    return { error: 'Bekleyen antrenör talebi bulunamadı.' };
  }

  const fromTrainerId = request.gymMember.trainerId;
  const now = new Date();

  if (parsed.data.decision === 'REJECT') {
    await prisma.$transaction(async (tx) => {
      await tx.trainerRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          decidedById: context.actorId,
          decidedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: context.actorId,
          organizationId: context.organizationId,
          action: 'MEMBER_UPDATED',
          entityType: 'trainer_request',
          entityId: request.id,
          metadata: { kind: 'trainer_request_rejected', gymMemberId: request.gymMemberId },
        },
      });
    });

    if (request.gymMember.userId) {
      await sendPushToUser(request.gymMember.userId, {
        title: 'Antrenör talebi',
        body: 'Talebiniz için resepsiyonla görüşün',
        url: '/athlete/trainers',
        tag: `trainer-request-${request.id}`,
      });
    }

    revalidatePath('/dashboard/trainer-requests');
    revalidatePath(`/dashboard/members/${request.gymMemberId}`);
    revalidatePath('/athlete/trainers');
    revalidatePath('/athlete');
    return { success: 'Antrenör talebi reddedildi.' };
  }

  let toTrainerId: string | null = null;
  if (request.requestType === 'REMOVE') {
    toTrainerId = null;
  } else {
    toTrainerId = parsed.data.resultingTrainerId ?? request.preferredTrainerId ?? null;
    if (!toTrainerId) {
      return { error: 'Onay için bir antrenör seçilmelidir.' };
    }
    const trainerMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: toTrainerId,
        role: 'TRAINER',
        isActive: true,
      },
    });
    if (!trainerMembership) {
      return { error: 'Seçilen antrenör geçerli değil.' };
    }
  }

  const resultingTrainer =
    toTrainerId != null
      ? await prisma.user.findUnique({ where: { id: toTrainerId }, select: { id: true, name: true } })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: request.gymMemberId },
      data: { trainerId: toTrainerId },
    });

    await tx.trainerRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        decidedById: context.actorId,
        decidedAt: now,
        resultingTrainerId: toTrainerId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: request.gymMemberId,
        metadata: {
          kind: 'trainer_changed',
          requestId: request.id,
          from: fromTrainerId,
          to: toTrainerId,
        },
      },
    });
  });

  if (request.gymMember.userId) {
    const pushBody =
      request.requestType === 'REMOVE'
        ? 'Antrenör atamanız kaldırıldı.'
        : resultingTrainer?.name
          ? `Yeni antrenörünüz: ${resultingTrainer.name}`
          : 'Antrenör atamanız güncellendi.';
    await sendPushToUser(request.gymMember.userId, {
      title: 'Antrenörünüz',
      body: pushBody,
      url: '/athlete',
      tag: `trainer-request-${request.id}`,
    });
  }

  revalidatePath('/dashboard/trainer-requests');
  revalidatePath(`/dashboard/members/${request.gymMemberId}`);
  revalidatePath('/athlete/trainers');
  revalidatePath('/athlete');
  return { success: 'Antrenör talebi onaylandı.' };
}

const bioSchema = z.object({
  trainerUserId: z.string().cuid(),
  bio: z.string().max(5000).optional(),
  specialties: z.string().max(1000).optional(),
  maxMembers: z.coerce.number().int().min(1).max(10000).optional().or(z.literal('')),
});

export async function updateTrainerProfileBio(
  _prev: TrainerRequestActionState,
  formData: FormData,
): Promise<TrainerRequestActionState> {
  const trainerUserId = String(formData.get('trainerUserId') ?? '');
  const context = await getBioEditContext(trainerUserId);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = bioSchema.safeParse({
    trainerUserId,
    bio: formData.get('bio') || undefined,
    specialties: formData.get('specialties') || undefined,
    maxMembers: formData.get('maxMembers') || '',
  });
  if (!parsed.success) {
    return { error: 'Profil bilgileri geçersiz.' };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: context.organizationId, userId: trainerUserId, role: 'TRAINER', isActive: true },
  });
  if (!membership) {
    return { error: 'Bu kullanıcı aktif bir PT değil.' };
  }

  const specialties = parsed.data.specialties
    ? parsed.data.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  await prisma.$transaction(async (tx) => {
    const profile = await tx.trainerProfile.upsert({
      where: { organizationId_userId: { organizationId: context.organizationId, userId: trainerUserId } },
      update: {
        bio: parsed.data.bio?.trim() || null,
        specialties,
        maxMembers:
          parsed.data.maxMembers === '' || parsed.data.maxMembers === undefined
            ? null
            : parsed.data.maxMembers,
      },
      create: {
        organizationId: context.organizationId,
        userId: trainerUserId,
        bio: parsed.data.bio?.trim() || null,
        specialties,
        maxMembers:
          parsed.data.maxMembers === '' || parsed.data.maxMembers === undefined
            ? null
            : parsed.data.maxMembers,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'TRAINER_PROFILE_UPDATED',
        entityType: 'trainer_profile',
        entityId: profile.id,
        metadata: { trainerUserId, fields: ['bio', 'specialties', 'maxMembers'] },
      },
    });
  });

  revalidatePath('/dashboard/trainers');
  revalidatePath(`/dashboard/trainers/${trainerUserId}`);
  revalidatePath('/athlete/trainers');
  return { success: 'Antrenör profili güncellendi.' };
}

export async function cancelOwnTrainerRequest(requestId: string): Promise<TrainerRequestActionState> {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }

  const request = await prisma.trainerRequest.findFirst({
    where: {
      id: requestId,
      organizationId: session.user.organizationId,
      gymMemberId: session.user.gymMemberId,
      status: 'PENDING',
    },
  });
  if (!request) {
    return { error: 'İptal edilecek bekleyen talep bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.trainerRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id,
        organizationId: session.user!.organizationId!,
        action: 'MEMBER_UPDATED',
        entityType: 'trainer_request',
        entityId: request.id,
        metadata: { kind: 'trainer_request_cancelled', gymMemberId: request.gymMemberId },
      },
    });
  });

  revalidatePath('/athlete/trainers');
  revalidatePath('/athlete');
  revalidatePath('/dashboard/trainer-requests');
  return { success: 'Talebiniz iptal edildi.' };
}
