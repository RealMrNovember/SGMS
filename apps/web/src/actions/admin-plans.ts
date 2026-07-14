'use server';

import { requireSuperAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type PlanActionState = {
  error?: string;
  success?: string;
};

const planSchema = z.object({
  planId: z.string().cuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  priceMonthly: z.coerce.number().min(0),
  priceYearly: z.coerce.number().min(0),
  maxMembers: z.coerce.number().int().min(1),
  maxStaff: z.coerce.number().int().min(1),
  maxDevices: z.coerce.number().int().min(0),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export async function updateSaasPlan(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const parsed = planSchema.safeParse({
    planId: formData.get('planId'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    priceMonthly: formData.get('priceMonthly'),
    priceYearly: formData.get('priceYearly'),
    maxMembers: formData.get('maxMembers'),
    maxStaff: formData.get('maxStaff'),
    maxDevices: formData.get('maxDevices'),
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder'),
  });

  if (!parsed.success) {
    return { error: 'Plan alanlarını kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const data = parsed.data;

    await prisma.$transaction([
      prisma.plan.update({
        where: { id: data.planId },
        data: {
          name: data.name,
          description: data.description || null,
          priceMonthly: data.priceMonthly,
          priceYearly: data.priceYearly,
          maxMembers: data.maxMembers,
          maxStaff: data.maxStaff,
          maxDevices: data.maxDevices,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'SETTINGS_CHANGED',
          entityType: 'plan',
          entityId: data.planId,
          metadata: { updatedBy: 'master_admin' },
        },
      }),
    ]);

    revalidatePath('/admin/plans');
    return { success: 'Plan güncellendi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Plan güncellenemedi.',
    };
  }
}
