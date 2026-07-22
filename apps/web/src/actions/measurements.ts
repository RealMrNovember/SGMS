'use server';

import { isAthleteContext, resolveApiContext } from '@/lib/api/auth-context';
import { auth } from '@/lib/auth';
import { reevaluateGoalsForMember } from '@/lib/goals/reevaluate';
import { prisma } from '@/lib/prisma';
import { readProgressPhotoBuffer, uploadProgressPhoto } from '@/lib/storage';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { trainerScopedMemberWhere } from '@/lib/trainers/member-scope';
import type { MeasurementPhotoAngle, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

const PHOTO_ANGLES = new Set<MeasurementPhotoAngle>(['FRONT', 'SIDE', 'BACK', 'OTHER']);

const measurementFieldsSchema = z.object({
  weight: z.string().optional().or(z.literal('')),
  bodyFatPercentage: z.string().optional().or(z.literal('')),
  muscleMass: z.string().optional().or(z.literal('')),
  height: z.string().optional().or(z.literal('')),
  waistCm: z.string().optional().or(z.literal('')),
  chestCm: z.string().optional().or(z.literal('')),
  hipCm: z.string().optional().or(z.literal('')),
  armCm: z.string().optional().or(z.literal('')),
  thighCm: z.string().optional().or(z.literal('')),
  bodyWaterPercentage: z.string().optional().or(z.literal('')),
  visceralFatRating: z.string().optional().or(z.literal('')),
  restingHeartRate: z.string().optional().or(z.literal('')),
  measuredAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const addMeasurementSchema = measurementFieldsSchema.extend({
  gymMemberId: z.string().cuid(),
});

export type AddMeasurementState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export type UploadMeasurementPhotoState = {
  error?: string;
  success?: string;
};

function parseOptionalDecimal(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const num = Number(value.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const num = Number.parseInt(value.trim(), 10);
  return Number.isFinite(num) ? num : null;
}

function parseMeasurementValues(data: z.infer<typeof measurementFieldsSchema>) {
  return {
    weight: parseOptionalDecimal(data.weight),
    bodyFatPercentage: parseOptionalDecimal(data.bodyFatPercentage),
    muscleMass: parseOptionalDecimal(data.muscleMass),
    height: parseOptionalDecimal(data.height),
    waistCm: parseOptionalDecimal(data.waistCm),
    chestCm: parseOptionalDecimal(data.chestCm),
    hipCm: parseOptionalDecimal(data.hipCm),
    armCm: parseOptionalDecimal(data.armCm),
    thighCm: parseOptionalDecimal(data.thighCm),
    bodyWaterPercentage: parseOptionalDecimal(data.bodyWaterPercentage),
    visceralFatRating: parseOptionalDecimal(data.visceralFatRating),
    restingHeartRate: parseOptionalInt(data.restingHeartRate),
  };
}

function hasAnyMeasurementValue(values: ReturnType<typeof parseMeasurementValues>): boolean {
  return Object.values(values).some((value) => value !== null);
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
    role: actorRole,
  };
}

async function getAthleteMeasurementContext() {
  const result = await resolveApiContext();
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' as const };
  }

  return {
    organizationId: result.context.organizationId,
    actorId: result.context.userId,
    gymMemberId: result.context.gymMemberId,
  };
}

function formDataToMeasurementFields(formData: FormData) {
  return {
    weight: formData.get('weight') ?? '',
    bodyFatPercentage: formData.get('bodyFatPercentage') ?? '',
    muscleMass: formData.get('muscleMass') ?? '',
    height: formData.get('height') ?? '',
    waistCm: formData.get('waistCm') ?? '',
    chestCm: formData.get('chestCm') ?? '',
    hipCm: formData.get('hipCm') ?? '',
    armCm: formData.get('armCm') ?? '',
    thighCm: formData.get('thighCm') ?? '',
    bodyWaterPercentage: formData.get('bodyWaterPercentage') ?? '',
    visceralFatRating: formData.get('visceralFatRating') ?? '',
    restingHeartRate: formData.get('restingHeartRate') ?? '',
    measuredAt: formData.get('measuredAt') ?? '',
    notes: formData.get('notes') ?? '',
  };
}

async function createHealthMeasurementRecord(input: {
  organizationId: string;
  actorId: string;
  gymMemberId: string;
  values: ReturnType<typeof parseMeasurementValues>;
  measuredAt: Date;
  notes: string | null;
  source: string;
  revalidateGymMemberId: string;
}) {
  const measurement = await prisma.$transaction(async (tx) => {
    const created = await tx.healthMeasurement.create({
      data: {
        organizationId: input.organizationId,
        gymMemberId: input.gymMemberId,
        ...input.values,
        notes: input.notes,
        measuredAt: input.measuredAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        organizationId: input.organizationId,
        action: 'MEASUREMENT_ADDED',
        entityType: 'health_measurement',
        entityId: created.id,
        metadata: {
          gymMemberId: input.gymMemberId,
          measuredAt: input.measuredAt.toISOString(),
          ...input.values,
          source: input.source,
        },
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/members/${input.revalidateGymMemberId}`);
  revalidatePath(`/dashboard/members/${input.revalidateGymMemberId}/measurements`);
  revalidatePath('/athlete/measurements');

  // Faz 39 — bu ölçüm bir hedefi tamamlamış olabilir (ör. kilo hedefine ulaşıldı);
  // ana akışı asla bloklamaz/bozmaz (reevaluateGoalsForMember kendi try/catch'ine sahip).
  void reevaluateGoalsForMember(input.organizationId, input.gymMemberId, 'measurement');

  return measurement;
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
    ...formDataToMeasurementFields(formData),
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
    where: {
      id: data.gymMemberId,
      organizationId: context.organizationId,
      ...trainerScopedMemberWhere(context.role, context.actorId),
    },
  });

  if (!gymMember) {
    return { error: 'Sporcu bulunamadı veya size atanmamış.' };
  }

  const values = parseMeasurementValues(data);
  if (!hasAnyMeasurementValue(values)) {
    return { error: 'En az bir ölçüm değeri girin.' };
  }

  const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    return { fieldErrors: { measuredAt: 'Geçerli bir tarih girin.' } };
  }

  await createHealthMeasurementRecord({
    organizationId: context.organizationId,
    actorId: context.actorId,
    gymMemberId: data.gymMemberId,
    values,
    measuredAt,
    notes: data.notes || null,
    source: 'dashboard',
    revalidateGymMemberId: data.gymMemberId,
  });

  return { success: 'Ölçüm kaydedildi.' };
}

export async function addOwnHealthMeasurement(
  _prevState: AddMeasurementState,
  formData: FormData,
): Promise<AddMeasurementState> {
  const context = await getAthleteMeasurementContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = measurementFieldsSchema.safeParse(formDataToMeasurementFields(formData));
  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const values = parseMeasurementValues(parsed.data);
  if (!hasAnyMeasurementValue(values)) {
    return { error: 'En az bir ölçüm değeri girin.' };
  }

  const measuredAt = parsed.data.measuredAt ? new Date(parsed.data.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    return { fieldErrors: { measuredAt: 'Geçerli bir tarih girin.' } };
  }

  await createHealthMeasurementRecord({
    organizationId: context.organizationId,
    actorId: context.actorId,
    gymMemberId: context.gymMemberId,
    values,
    measuredAt,
    notes: parsed.data.notes || null,
    source: 'athlete_self',
    revalidateGymMemberId: context.gymMemberId,
  });

  return { success: 'Ölçüm kaydedildi.' };
}

export async function uploadMeasurementPhoto(
  _prevState: UploadMeasurementPhotoState,
  formData: FormData,
): Promise<UploadMeasurementPhotoState> {
  const context = await getMeasurementContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const gymMemberId = formData.get('gymMemberId');
  const angleRaw = formData.get('angle');
  const healthMeasurementIdRaw = formData.get('healthMeasurementId');
  const file = formData.get('file');

  if (typeof gymMemberId !== 'string' || !gymMemberId) {
    return { error: 'Sporcu seçimi gerekli.' };
  }

  if (!(file instanceof File)) {
    return { error: 'Fotoğraf dosyası gerekli.' };
  }

  const angle =
    typeof angleRaw === 'string' && PHOTO_ANGLES.has(angleRaw as MeasurementPhotoAngle)
      ? (angleRaw as MeasurementPhotoAngle)
      : 'OTHER';

  const gymMember = await prisma.gymMember.findFirst({
    where: {
      id: gymMemberId,
      organizationId: context.organizationId,
      ...trainerScopedMemberWhere(context.role, context.actorId),
    },
  });

  if (!gymMember) {
    return { error: 'Sporcu bulunamadı veya size atanmamış.' };
  }

  const healthMeasurementId =
    typeof healthMeasurementIdRaw === 'string' && healthMeasurementIdRaw
      ? healthMeasurementIdRaw
      : null;

  if (healthMeasurementId) {
    const measurement = await prisma.healthMeasurement.findFirst({
      where: { id: healthMeasurementId, organizationId: context.organizationId, gymMemberId },
    });
    if (!measurement) {
      return { error: 'Ölçüm kaydı bulunamadı.' };
    }
  }

  const fileResult = await readProgressPhotoBuffer(file);
  if (!fileResult.ok) {
    return { error: fileResult.error };
  }

  const photoId = crypto.randomUUID();
  const uploaded = await uploadProgressPhoto({
    organizationId: context.organizationId,
    gymMemberId,
    photoId,
    buffer: fileResult.buffer,
    mimeType: fileResult.mimeType,
  });

  await prisma.measurementPhoto.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId,
      healthMeasurementId,
      angle,
      photoUrl: uploaded.url,
      uploadedById: context.actorId,
    },
  });

  revalidatePath(`/dashboard/members/${gymMemberId}/measurements`);

  return { success: 'Fotoğraf yüklendi.' };
}
