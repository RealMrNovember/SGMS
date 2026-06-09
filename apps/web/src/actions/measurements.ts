'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

const addMeasurementSchema = z.object({
  gymMemberId: z.string().cuid(),
  weight: z.string().optional().or(z.literal('')),
  bodyFatPercentage: z.string().optional().or(z.literal('')),
  muscleMass: z.string().optional().or(z.literal('')),
  height: z.string().optional().or(z.literal('')),
  measuredAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export type AddMeasurementState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

function parseOptionalDecimal(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const num = Number(value.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

async function getMeasurementContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const actorRole = session.user.role;

  if (!organizationId || !actorRole || !MEASUREMENT_ROLES.has(actorRole)) {
    return { error: 'Ölçüm eklemek için salon personeli yetkisi gerekir.' as const };
  }

  return {
    organizationId,
    actorId: session.user.id,
  };
}

export async function addHealthMeasurement(
  _prevState: AddMeasurementState,
  formData: FormData,
): Promise<AddMeasurementState> {
  const context = await getMeasurementContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = addMeasurementSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    weight: formData.get('weight') ?? '',
    bodyFatPercentage: formData.get('bodyFatPercentage') ?? '',
    muscleMass: formData.get('muscleMass') ?? '',
    height: formData.get('height') ?? '',
    measuredAt: formData.get('measuredAt') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: AddMeasurementState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const gymMember = await prisma.gymMember.findFirst({
    where: { id: data.gymMemberId, organizationId: context.organizationId },
  });

  if (!gymMember) {
    return { error: 'Sporcu bu salonda bulunamadı.' };
  }

  const weight = parseOptionalDecimal(data.weight);
  const bodyFatPercentage = parseOptionalDecimal(data.bodyFatPercentage);
  const muscleMass = parseOptionalDecimal(data.muscleMass);
  const height = parseOptionalDecimal(data.height);

  if (weight === null && bodyFatPercentage === null && muscleMass === null && height === null) {
    return { error: 'En az bir ölçüm değeri girin (kilo, yağ oranı, kas kütlesi veya boy).' };
  }

  const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    return { fieldErrors: { measuredAt: 'Geçerli bir tarih girin.' } };
  }

  const measurement = await prisma.$transaction(async (tx) => {
    const created = await tx.healthMeasurement.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: data.gymMemberId,
        weight,
        bodyFatPercentage,
        muscleMass,
        height,
        notes: data.notes || null,
        measuredAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEASUREMENT_ADDED',
        entityType: 'health_measurement',
        entityId: created.id,
        metadata: {
          gymMemberId: data.gymMemberId,
          measuredAt: measuredAt.toISOString(),
          weight,
          bodyFatPercentage,
          muscleMass,
          height,
          source: 'dashboard',
        },
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/members/${data.gymMemberId}`);
  revalidatePath(`/dashboard/members/${data.gymMemberId}/measurements`);

  return { success: 'Ölçüm kaydedildi.' };
}
