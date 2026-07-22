'use server';

import { auth } from '@/lib/auth';
import { calculateSessionCommission } from '@/lib/trainers/commission';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
const SCHEDULING_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

export type TrainerActionState = {
  error?: string;
  success?: string;
};

async function getTrainerContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const role = session.user.role;

  if (!organizationId || !role || !SCHEDULING_ROLES.has(role)) {
    return { error: 'Bu işlem için OWNER, ADMIN, STAFF veya TRAINER yetkisi gerekir.' as const };
  }

  return { organizationId, userId, role };
}

function revalidateTrainerViews(trainerUserId: string) {
  revalidatePath('/dashboard/trainers');
  revalidatePath(`/dashboard/trainers/${trainerUserId}`);
}

const upsertProfileSchema = z.object({
  trainerUserId: z.string().cuid(),
  commissionModel: z.enum(['FIXED_PER_SESSION', 'PERCENTAGE_OF_REVENUE', 'TIERED']),
  baseCommissionRate: z.coerce.number().min(0).max(100000),
  hourlyRate: z.coerce.number().min(0).max(100000).optional().or(z.literal('')),
});

/** Senaryo: Salon sahibi yeni işe aldığı bir PT'ye komisyon modelini tanımlar —
 * seans başına sabit ücret mi, cirodan yüzde mi, yoksa performansa bağlı kademeli mi. */
export async function upsertTrainerProfile(
  _prev: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const context = await getTrainerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  if (!MANAGER_ROLES.has(context.role)) {
    return { error: 'Komisyon modeli yalnızca OWNER veya ADMIN tarafından tanımlanabilir.' };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = upsertProfileSchema.safeParse({
    trainerUserId: formData.get('trainerUserId'),
    commissionModel: formData.get('commissionModel'),
    baseCommissionRate: formData.get('baseCommissionRate'),
    hourlyRate: formData.get('hourlyRate') || '',
  });

  if (!parsed.success) {
    return { error: 'Lütfen komisyon modeli ve oranını doğru girin.' };
  }

  const { trainerUserId, commissionModel, baseCommissionRate, hourlyRate } = parsed.data;

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: context.organizationId, userId: trainerUserId, isActive: true },
  });
  if (!membership || membership.role !== 'TRAINER') {
    return { error: 'Bu kullanıcı bu salonda aktif bir PT (TRAINER) değil.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.trainerProfile.upsert({
        where: { organizationId_userId: { organizationId: context.organizationId, userId: trainerUserId } },
        update: {
          commissionModel,
          baseCommissionRate,
          hourlyRate: hourlyRate === '' || hourlyRate === undefined ? null : hourlyRate,
        },
        create: {
          organizationId: context.organizationId,
          userId: trainerUserId,
          commissionModel,
          baseCommissionRate,
          hourlyRate: hourlyRate === '' || hourlyRate === undefined ? null : hourlyRate,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: context.userId,
          organizationId: context.organizationId,
          action: 'TRAINER_PROFILE_UPDATED',
          entityType: 'trainer_profile',
          entityId: profile.id,
          metadata: { trainerUserId, commissionModel, baseCommissionRate },
        },
      });
    });

    revalidateTrainerViews(trainerUserId);
    return { success: 'Komisyon modeli kaydedildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Komisyon modeli kaydedilemedi.' };
  }
}

const scheduleSessionSchema = z.object({
  trainerUserId: z.string().cuid(),
  gymMemberId: z.string().cuid(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});

/** Senaryo: Bir üye PT dersi için randevu alır — resepsiyon ya da PT'nin kendisi
 * takvime bir seans ekler. */
export async function schedulePtSession(
  _prev: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const context = await getTrainerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = scheduleSessionSchema.safeParse({
    trainerUserId: formData.get('trainerUserId'),
    gymMemberId: formData.get('gymMemberId'),
    scheduledAt: formData.get('scheduledAt'),
    durationMinutes: formData.get('durationMinutes'),
  });

  if (!parsed.success) {
    return { error: 'Lütfen tarih, üye ve süreyi doğru girin.' };
  }

  const { trainerUserId, gymMemberId, scheduledAt, durationMinutes } = parsed.data;

  if (context.role === 'TRAINER' && trainerUserId !== context.userId) {
    return { error: 'Yalnızca kendi seanslarınızı planlayabilirsiniz.' };
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return { error: 'Geçersiz tarih/saat.' };
  }

  const [member, trainerMembership] = await Promise.all([
    prisma.gymMember.findFirst({ where: { id: gymMemberId, organizationId: context.organizationId } }),
    prisma.organizationMember.findFirst({
      where: { organizationId: context.organizationId, userId: trainerUserId, isActive: true },
    }),
  ]);

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }
  if (!trainerMembership || trainerMembership.role !== 'TRAINER') {
    return { error: 'Seçilen kişi bu salonda aktif bir PT değil.' };
  }

  try {
    const session = await prisma.ptSession.create({
      data: {
        organizationId: context.organizationId,
        trainerUserId,
        gymMemberId,
        scheduledAt: scheduledDate,
        durationMinutes,
        status: 'SCHEDULED',
        createdById: context.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'PT_SESSION_SCHEDULED',
        entityType: 'pt_session',
        entityId: session.id,
        metadata: { trainerUserId, gymMemberId, scheduledAt: scheduledDate.toISOString() },
      },
    });

    revalidateTrainerViews(trainerUserId);
    return { success: 'PT seansı planlandı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Seans oluşturulamadı.' };
  }
}

const completeSessionSchema = z.object({
  sessionId: z.string().cuid(),
  revenueAmount: z.coerce.number().min(0).max(1_000_000),
});

/** Senaryo: Ders bitti — PT ya da resepsiyon dersi tamamlandı olarak işaretler ve
 * o dersin ücretini onaylar; sistem PT'nin komisyon modeline göre hak edilen primi
 * otomatik hesaplar. */
export async function completePtSession(
  _prev: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const context = await getTrainerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = completeSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    revenueAmount: formData.get('revenueAmount'),
  });

  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir tutar girin.' };
  }

  const { sessionId, revenueAmount } = parsed.data;

  const session = await prisma.ptSession.findFirst({
    where: { id: sessionId, organizationId: context.organizationId },
  });
  if (!session) {
    return { error: 'Seans bulunamadı.' };
  }
  if (context.role === 'TRAINER' && session.trainerUserId !== context.userId) {
    return { error: 'Yalnızca kendi seanslarınızı tamamlayabilirsiniz.' };
  }
  if (session.status !== 'SCHEDULED') {
    return { error: 'Bu seans zaten sonuçlandırılmış.' };
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { organizationId_userId: { organizationId: context.organizationId, userId: session.trainerUserId } },
  });

  const monthStart = new Date(session.scheduledAt.getFullYear(), session.scheduledAt.getMonth(), 1);
  const monthEnd = new Date(session.scheduledAt.getFullYear(), session.scheduledAt.getMonth() + 1, 1);
  const sessionCountThisMonth = await prisma.ptSession.count({
    where: {
      organizationId: context.organizationId,
      trainerUserId: session.trainerUserId,
      status: 'COMPLETED',
      scheduledAt: { gte: monthStart, lt: monthEnd },
    },
  });

  const commissionAmount = profile
    ? calculateSessionCommission({
        model: profile.commissionModel,
        baseRate: Number(profile.baseCommissionRate),
        revenueAmount,
        sessionCountThisMonth,
      })
    : 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ptSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          revenueAmount,
          commissionAmount,
          completedAt: new Date(),
        },
      });

      // Seans ücreti üye cari hesabına yansır — kasa/POS tahsilatı buradan yapılır.
      if (revenueAmount > 0 && session.gymMemberId) {
        const expense = await tx.expense.create({
          data: {
            organizationId: context.organizationId,
            gymMemberId: session.gymMemberId,
            amount: revenueAmount,
            currency: 'TRY',
            description: `PT seansı (${session.scheduledAt.toLocaleDateString('tr-TR')})`,
            status: 'OPEN',
            createdById: context.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: context.userId,
            organizationId: context.organizationId,
            action: 'EXPENSE_ADDED',
            entityType: 'expense',
            entityId: expense.id,
            metadata: {
              source: 'pt_session',
              ptSessionId: sessionId,
              revenueAmount,
              commissionAmount,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: context.userId,
          organizationId: context.organizationId,
          action: 'PT_SESSION_COMPLETED',
          entityType: 'pt_session',
          entityId: sessionId,
          metadata: { revenueAmount, commissionAmount },
        },
      });
    });

    revalidateTrainerViews(session.trainerUserId);
    revalidatePath(`/dashboard/members/${session.gymMemberId}`);
    revalidatePath('/dashboard/pos');
    return {
      success:
        revenueAmount > 0
          ? `Seans tamamlandı — ${revenueAmount.toFixed(2)} ₺ üye hesabına işlendi, prim: ${commissionAmount.toFixed(2)} ₺.`
          : `Seans tamamlandı — hak edilen prim: ${commissionAmount.toFixed(2)} ₺.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Seans tamamlanamadı.' };
  }
}

const cancelSessionSchema = z.object({
  sessionId: z.string().cuid(),
  reason: z.enum(['CANCELED_BY_MEMBER', 'CANCELED_BY_TRAINER', 'NO_SHOW']),
});

/** Senaryo: Üye derse gelmedi (no-show) ya da son anda iptal etti — PT'nin boşa
 * giden saatinin ve iptal oranının kaydedilmesi, performans raporlarında görünür olması için. */
export async function cancelPtSession(
  _prev: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  const context = await getTrainerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = cancelSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  const { sessionId, reason } = parsed.data;

  const session = await prisma.ptSession.findFirst({
    where: { id: sessionId, organizationId: context.organizationId },
  });
  if (!session) {
    return { error: 'Seans bulunamadı.' };
  }
  if (context.role === 'TRAINER' && session.trainerUserId !== context.userId) {
    return { error: 'Yalnızca kendi seanslarınızı iptal edebilirsiniz.' };
  }
  if (session.status !== 'SCHEDULED') {
    return { error: 'Bu seans zaten sonuçlandırılmış.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ptSession.update({
        where: { id: sessionId },
        data: { status: reason, completedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: context.userId,
          organizationId: context.organizationId,
          action: 'PT_SESSION_CANCELED',
          entityType: 'pt_session',
          entityId: sessionId,
          metadata: { reason },
        },
      });
    });

    revalidateTrainerViews(session.trainerUserId);
    return { success: 'Seans durumu güncellendi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Seans güncellenemedi.' };
  }
}
