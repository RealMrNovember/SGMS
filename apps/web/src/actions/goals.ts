'use server';

import { isAthleteContext, resolveApiContext } from '@/lib/api/auth-context';
import { auth } from '@/lib/auth';
import { createAthleteGoal } from '@/lib/goals/create';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { GoalDirection, GoalTargetType, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const GOAL_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'TRAINER']);

const TARGET_TYPES = [
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'BODY_FAT_REDUCTION',
  'MEASUREMENT_CHANGE',
  'WORKOUT_FREQUENCY',
  'CUSTOM',
] as const;

export type GoalActionState = { error?: string; success?: string };

const goalFieldsSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  measurementField: z.string().optional().or(z.literal('')),
  direction: z.enum(['INCREASE', 'DECREASE']).optional().or(z.literal('')),
  targetValue: z.string().optional().or(z.literal('')),
  targetDate: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const goalSchema = goalFieldsSchema.extend({ gymMemberId: z.string().cuid() });

function parseGoalFormData(formData: FormData) {
  return goalSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    targetType: formData.get('targetType'),
    measurementField: formData.get('measurementField') ?? '',
    direction: formData.get('direction') ?? '',
    targetValue: formData.get('targetValue') ?? '',
    targetDate: formData.get('targetDate') ?? '',
    notes: formData.get('notes') ?? '',
  });
}

function parseOwnGoalFormData(formData: FormData) {
  return goalFieldsSchema.safeParse({
    targetType: formData.get('targetType'),
    measurementField: formData.get('measurementField') ?? '',
    direction: formData.get('direction') ?? '',
    targetValue: formData.get('targetValue') ?? '',
    targetDate: formData.get('targetDate') ?? '',
    notes: formData.get('notes') ?? '',
  });
}

async function getStaffGoalContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !GOAL_MANAGER_ROLES.has(role)) {
    return { error: 'Hedef atamak için OWNER, ADMIN veya PT yetkisi gerekir.' as const };
  }
  return { organizationId, actorId: session.user.id };
}

/** PT/OWNER/ADMIN sporcuya hedef atar — `/dashboard/members/[id]` "Hedef Ata" paneli. */
export async function assignAthleteGoal(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const context = await getStaffGoalContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = parseGoalFormData(formData);
  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const result = await createAthleteGoal({
    organizationId: context.organizationId,
    gymMemberId: parsed.data.gymMemberId,
    createdByType: 'TRAINER',
    createdById: context.actorId,
    targetType: parsed.data.targetType as GoalTargetType,
    measurementField: parsed.data.measurementField || null,
    direction: (parsed.data.direction || null) as GoalDirection | null,
    targetValue: parsed.data.targetValue ? Number(parsed.data.targetValue.replace(',', '.')) : null,
    targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
    notes: parsed.data.notes || null,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/dashboard/members/${parsed.data.gymMemberId}`);
  return { success: 'Hedef atandı.' };
}

/**
 * Sporcu (PT'si olsun ya da olmasın) kendi hedefini koyar — web sporcu portalı
 * ve mobil `/api/v1/goals` POST **aynı fonksiyonu** kullanır (`request` verilirse
 * Bearer token da kabul edilir, bkz. `actions/athlete-profile.ts`).
 */
export async function createOwnAthleteGoal(
  _prevState: GoalActionState,
  formData: FormData,
  request?: Request,
): Promise<GoalActionState> {
  const result = await resolveApiContext(request);
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  const { organizationId, gymMemberId, userId } = result.context;

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = parseOwnGoalFormData(formData);
  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const created = await createAthleteGoal({
    organizationId,
    gymMemberId,
    createdByType: 'SELF',
    createdById: userId,
    targetType: parsed.data.targetType as GoalTargetType,
    measurementField: parsed.data.measurementField || null,
    direction: (parsed.data.direction || null) as GoalDirection | null,
    targetValue: parsed.data.targetValue ? Number(parsed.data.targetValue.replace(',', '.')) : null,
    targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
    notes: parsed.data.notes || null,
  });

  if (!created.ok) {
    return { error: created.error };
  }

  revalidatePath('/athlete/goals');
  return { success: 'Hedef oluşturuldu.' };
}

/** Hedefi iptal eder — atayan taraf (staff/PT) veya sporcunun kendisi. */
export async function cancelAthleteGoal(goalId: string, request?: Request): Promise<GoalActionState> {
  const result = await resolveApiContext(request);
  if ('response' in result) {
    return { error: 'Bu işlem için oturum gerekir.' };
  }
  const { context } = result;

  const goal = await prisma.athleteGoal.findFirst({
    where: { id: goalId, organizationId: context.organizationId },
  });
  if (!goal) {
    return { error: 'Hedef bulunamadı.' };
  }

  if (isAthleteContext(context)) {
    if (goal.gymMemberId !== context.gymMemberId) {
      return { error: 'Bu hedefi iptal etme yetkiniz yok.' };
    }
  } else if (!GOAL_MANAGER_ROLES.has(context.role)) {
    return { error: 'Hedef iptali için OWNER, ADMIN veya PT yetkisi gerekir.' };
  }

  if (goal.status !== 'ACTIVE') {
    return { error: 'Sadece aktif hedefler iptal edilebilir.' };
  }

  await prisma.athleteGoal.update({ where: { id: goal.id }, data: { status: 'CANCELLED' } });

  revalidatePath(`/dashboard/members/${goal.gymMemberId}`);
  revalidatePath('/athlete/goals');
  return { success: 'Hedef iptal edildi.' };
}
