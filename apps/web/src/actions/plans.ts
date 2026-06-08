'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PLAN_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

const planFieldsSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().or(z.literal('')),
  durationDays: z.coerce.number().int().min(1).max(3650),
  price: z.coerce.number().min(0),
  currency: z.enum(['TRY', 'USD', 'AZN']).default('TRY'),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const createPlanSchema = planFieldsSchema;
const updatePlanSchema = planFieldsSchema.extend({
  planId: z.string().cuid(),
});

export type PlanFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

async function getPlanManagerContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;

  if (!organizationId || !role || !PLAN_MANAGER_ROLES.has(role)) {
    return { error: 'Plan yönetimi için OWNER veya ADMIN yetkisi gerekir.' as const };
  }

  return { organizationId, actorId: session.user.id };
}

export async function createGymMembershipPlan(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const context = await getPlanManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createPlanSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    durationDays: formData.get('durationDays'),
    price: formData.get('price'),
    currency: formData.get('currency') ?? 'TRY',
    sortOrder: formData.get('sortOrder') ?? '0',
  });

  if (!parsed.success) {
    const fieldErrors: PlanFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const existing = await prisma.gymMembershipPlan.findUnique({
    where: {
      organizationId_name: {
        organizationId: context.organizationId,
        name: data.name,
      },
    },
  });

  if (existing) {
    return { fieldErrors: { name: 'Bu isimde bir plan zaten var.' } };
  }

  await prisma.gymMembershipPlan.create({
    data: {
      organizationId: context.organizationId,
      name: data.name,
      description: data.description || null,
      durationDays: data.durationDays,
      price: data.price,
      currency: data.currency,
      sortOrder: data.sortOrder,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'SETTINGS_CHANGED',
      entityType: 'gym_membership_plan',
      metadata: { name: data.name, operation: 'create' },
    },
  });

  revalidatePath('/dashboard/plans');
  revalidatePath('/dashboard/members');

  return { success: `"${data.name}" planı oluşturuldu.` };
}

export async function updateGymMembershipPlan(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const context = await getPlanManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = updatePlanSchema.safeParse({
    planId: formData.get('planId'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    durationDays: formData.get('durationDays'),
    price: formData.get('price'),
    currency: formData.get('currency') ?? 'TRY',
    sortOrder: formData.get('sortOrder') ?? '0',
  });

  if (!parsed.success) {
    const fieldErrors: PlanFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const plan = await prisma.gymMembershipPlan.findFirst({
    where: { id: data.planId, organizationId: context.organizationId },
  });

  if (!plan) {
    return { error: 'Plan bulunamadı.' };
  }

  if (data.name !== plan.name) {
    const nameTaken = await prisma.gymMembershipPlan.findUnique({
      where: {
        organizationId_name: {
          organizationId: context.organizationId,
          name: data.name,
        },
      },
    });
    if (nameTaken) {
      return { fieldErrors: { name: 'Bu isimde bir plan zaten var.' } };
    }
  }

  await prisma.gymMembershipPlan.update({
    where: { id: data.planId },
    data: {
      name: data.name,
      description: data.description || null,
      durationDays: data.durationDays,
      price: data.price,
      currency: data.currency,
      sortOrder: data.sortOrder,
    },
  });

  revalidatePath('/dashboard/plans');
  revalidatePath('/dashboard/members');

  return { success: `"${data.name}" güncellendi.` };
}

export async function toggleGymMembershipPlanActive(planId: string): Promise<{ error?: string }> {
  const context = await getPlanManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const plan = await prisma.gymMembershipPlan.findFirst({
    where: { id: planId, organizationId: context.organizationId },
  });

  if (!plan) {
    return { error: 'Plan bulunamadı.' };
  }

  await prisma.gymMembershipPlan.update({
    where: { id: planId },
    data: { isActive: !plan.isActive },
  });

  revalidatePath('/dashboard/plans');
  revalidatePath('/dashboard/members');
  return {};
}
