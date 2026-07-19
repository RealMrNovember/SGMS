'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import {
  generateEquipmentPublicCode,
  hashEquipmentToken,
  issueEquipmentQrToken,
  verifyEquipmentQrToken,
} from '@/lib/equipment-qr';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { EquipmentCategory, EquipmentStatus, MaintenanceFrequency } from '@sgms/database';
import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type EquipmentActionState = {
  error?: string;
  success?: string;
  publicCode?: string;
  qrToken?: string;
  equipmentId?: string;
};

const EQUIPMENT_CATEGORIES = [
  'CARDIO',
  'STRENGTH',
  'GROUP_CLASS',
  'OTHER',
] as const satisfies readonly EquipmentCategory[];

const EQUIPMENT_STATUSES = [
  'OPERATIONAL',
  'UNDER_MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
] as const satisfies readonly EquipmentStatus[];

const MAINTENANCE_FREQUENCIES = [
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
] as const satisfies readonly MaintenanceFrequency[];

async function getEquipmentContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }

  return { organizationId, actorId: session.user.id };
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDecimalInput(value: string | null | undefined): number | null {
  if (!value || !value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function advanceMaintenanceDueDate(from: Date, frequency: MaintenanceFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

async function generateUniquePublicCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateEquipmentPublicCode();
    const existing = await prisma.gymEquipment.findUnique({ where: { publicCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error('publicCode üretilemedi.');
}

const createEquipmentSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.enum(EQUIPMENT_CATEGORIES),
  serialNumber: z.string().max(80).optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  warrantyExpiresAt: z.string().optional(),
  location: z.string().max(120).optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export async function createEquipment(
  _prev: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createEquipmentSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category') ?? 'OTHER',
    serialNumber: formData.get('serialNumber') || undefined,
    purchaseDate: formData.get('purchaseDate') || undefined,
    purchasePrice: formData.get('purchasePrice') || undefined,
    warrantyExpiresAt: formData.get('warrantyExpiresAt') || undefined,
    location: formData.get('location') || undefined,
    photoUrl: formData.get('photoUrl') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Ekipman bilgilerini kontrol edin.' };
  }

  const placeholderHash = createHash('sha256').update(randomBytes(32)).digest('hex');
  const publicCode = await generateUniquePublicCode();

  const equipment = await prisma.gymEquipment.create({
    data: {
      organizationId: context.organizationId,
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      serialNumber: parsed.data.serialNumber?.trim() || null,
      purchaseDate: parseDateInput(parsed.data.purchaseDate),
      purchasePrice: parseDecimalInput(parsed.data.purchasePrice),
      warrantyExpiresAt: parseDateInput(parsed.data.warrantyExpiresAt),
      location: parsed.data.location?.trim() || null,
      photoUrl: parsed.data.photoUrl?.trim() || null,
      qrTokenHash: placeholderHash,
      publicCode,
    },
  });

  const { token, tokenHash } = issueEquipmentQrToken(context.organizationId, equipment.id);

  await prisma.$transaction(async (tx) => {
    await tx.gymEquipment.update({
      where: { id: equipment.id },
      data: { qrTokenHash: tokenHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'EQUIPMENT_CREATED',
        entityType: 'gym_equipment',
        entityId: equipment.id,
        metadata: { name: equipment.name, category: equipment.category, publicCode },
      },
    });
  });

  revalidatePath('/dashboard/equipment');
  return {
    success: `${equipment.name} ekipman envantere eklendi.`,
    publicCode,
    qrToken: token,
    equipmentId: equipment.id,
  };
}

export async function updateEquipmentStatus(
  equipmentId: string,
  status: (typeof EQUIPMENT_STATUSES)[number],
): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }
  if (!EQUIPMENT_STATUSES.includes(status)) {
    return { error: 'Geçersiz durum.' };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const equipment = await prisma.gymEquipment.findFirst({
    where: { id: equipmentId, organizationId: context.organizationId },
  });
  if (!equipment) {
    return { error: 'Ekipman bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymEquipment.update({
      where: { id: equipmentId },
      data: { status },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'EQUIPMENT_UPDATED',
        entityType: 'gym_equipment',
        entityId: equipmentId,
        metadata: { from: equipment.status, to: status },
      },
    });
  });

  revalidatePath('/dashboard/equipment');
  revalidatePath(`/dashboard/equipment/${equipmentId}`);
  return { success: 'Ekipman durumu güncellendi.' };
}

const reportIssueSchema = z.object({
  equipmentId: z.string().cuid(),
  issueDescription: z.string().min(3).max(2000),
  setUnderMaintenance: z.enum(['true', 'false']).optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export async function reportIssue(
  _prev: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = reportIssueSchema.safeParse({
    equipmentId: formData.get('equipmentId'),
    issueDescription: formData.get('issueDescription'),
    setUnderMaintenance: formData.get('setUnderMaintenance') ?? 'false',
    photoUrl: formData.get('photoUrl') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Arıza bildirimi bilgilerini kontrol edin.' };
  }

  const equipment = await prisma.gymEquipment.findFirst({
    where: { id: parsed.data.equipmentId, organizationId: context.organizationId },
  });
  if (!equipment) {
    return { error: 'Ekipman bulunamadı.' };
  }

  const setUnderMaintenance = parsed.data.setUnderMaintenance === 'true';

  await prisma.$transaction(async (tx) => {
    await tx.equipmentServiceLog.create({
      data: {
        organizationId: context.organizationId,
        equipmentId: equipment.id,
        reportedById: context.actorId,
        issueDescription: parsed.data.issueDescription.trim(),
        photoUrl: parsed.data.photoUrl?.trim() || null,
      },
    });

    if (setUnderMaintenance && equipment.status === 'OPERATIONAL') {
      await tx.gymEquipment.update({
        where: { id: equipment.id },
        data: { status: 'UNDER_MAINTENANCE' },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'EQUIPMENT_ISSUE_REPORTED',
        entityType: 'gym_equipment',
        entityId: equipment.id,
        metadata: {
          issueDescription: parsed.data.issueDescription.trim(),
          setUnderMaintenance,
        },
      },
    });
  });

  revalidatePath('/dashboard/equipment');
  revalidatePath(`/dashboard/equipment/${equipment.id}`);
  return { success: 'Arıza bildirimi kaydedildi.' };
}

const serviceLogSchema = z.object({
  equipmentId: z.string().cuid(),
  issueDescription: z.string().min(3).max(2000),
  serviceProvider: z.string().max(120).optional(),
  serviceDate: z.string().optional(),
  cost: z.string().optional(),
  warrantyClaim: z.enum(['true', 'false']).optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export async function addServiceLog(
  _prev: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = serviceLogSchema.safeParse({
    equipmentId: formData.get('equipmentId'),
    issueDescription: formData.get('issueDescription'),
    serviceProvider: formData.get('serviceProvider') || undefined,
    serviceDate: formData.get('serviceDate') || undefined,
    cost: formData.get('cost') || undefined,
    warrantyClaim: formData.get('warrantyClaim') ?? 'false',
    photoUrl: formData.get('photoUrl') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Servis kaydı bilgilerini kontrol edin.' };
  }

  const equipment = await prisma.gymEquipment.findFirst({
    where: { id: parsed.data.equipmentId, organizationId: context.organizationId },
  });
  if (!equipment) {
    return { error: 'Ekipman bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.equipmentServiceLog.create({
      data: {
        organizationId: context.organizationId,
        equipmentId: equipment.id,
        reportedById: context.actorId,
        issueDescription: parsed.data.issueDescription.trim(),
        serviceProvider: parsed.data.serviceProvider?.trim() || null,
        serviceDate: parseDateInput(parsed.data.serviceDate),
        cost: parseDecimalInput(parsed.data.cost),
        warrantyClaim: parsed.data.warrantyClaim === 'true',
        photoUrl: parsed.data.photoUrl?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'EQUIPMENT_SERVICE_LOGGED',
        entityType: 'gym_equipment',
        entityId: equipment.id,
        metadata: {
          serviceProvider: parsed.data.serviceProvider?.trim() || null,
          warrantyClaim: parsed.data.warrantyClaim === 'true',
        },
      },
    });
  });

  revalidatePath(`/dashboard/equipment/${equipment.id}`);
  return { success: 'Servis kaydı eklendi.' };
}

const maintenanceScheduleSchema = z.object({
  equipmentId: z.string().cuid().optional().or(z.literal('')),
  title: z.string().min(2).max(120),
  frequency: z.enum(MAINTENANCE_FREQUENCIES),
  nextDueDate: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export async function createMaintenanceSchedule(
  _prev: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const equipmentIdRaw = formData.get('equipmentId');
  const parsed = maintenanceScheduleSchema.safeParse({
    equipmentId: equipmentIdRaw || undefined,
    title: formData.get('title'),
    frequency: formData.get('frequency') ?? 'MONTHLY',
    nextDueDate: formData.get('nextDueDate'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Bakım planı bilgilerini kontrol edin.' };
  }

  const nextDueDate = parseDateInput(parsed.data.nextDueDate);
  if (!nextDueDate) {
    return { error: 'Geçerli bir sonraki bakım tarihi girin.' };
  }

  const equipmentId = parsed.data.equipmentId?.trim() || null;
  if (equipmentId) {
    const equipment = await prisma.gymEquipment.findFirst({
      where: { id: equipmentId, organizationId: context.organizationId },
    });
    if (!equipment) {
      return { error: 'Ekipman bulunamadı.' };
    }
  }

  const schedule = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceSchedule.create({
      data: {
        organizationId: context.organizationId,
        equipmentId,
        title: parsed.data.title.trim(),
        frequency: parsed.data.frequency,
        nextDueDate,
        notes: parsed.data.notes?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MAINTENANCE_SCHEDULE_UPDATED',
        entityType: 'maintenance_schedule',
        entityId: created.id,
        metadata: { title: created.title, frequency: created.frequency, nextDueDate: nextDueDate.toISOString() },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/equipment');
  if (equipmentId) {
    revalidatePath(`/dashboard/equipment/${equipmentId}`);
  }
  return { success: `"${schedule.title}" bakım planı oluşturuldu.` };
}

export async function markMaintenanceDone(scheduleId: string): Promise<EquipmentActionState> {
  const context = await getEquipmentContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const schedule = await prisma.maintenanceSchedule.findFirst({
    where: { id: scheduleId, organizationId: context.organizationId },
  });
  if (!schedule) {
    return { error: 'Bakım planı bulunamadı.' };
  }
  if (!schedule.isActive) {
    return { error: 'Bu bakım planı pasif.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDueDate = advanceMaintenanceDueDate(schedule.nextDueDate, schedule.frequency);

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        lastDoneAt: today,
        nextDueDate,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MAINTENANCE_SCHEDULE_UPDATED',
        entityType: 'maintenance_schedule',
        entityId: scheduleId,
        metadata: {
          title: schedule.title,
          lastDoneAt: today.toISOString(),
          nextDueDate: nextDueDate.toISOString(),
        },
      },
    });
  });

  revalidatePath('/dashboard/equipment');
  if (schedule.equipmentId) {
    revalidatePath(`/dashboard/equipment/${schedule.equipmentId}`);
  }
  return { success: 'Bakım tamamlandı olarak işaretlendi.' };
}

export async function resolveEquipmentByCode(code: string, organizationId: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const byPublicCode = await prisma.gymEquipment.findFirst({
    where: { publicCode: trimmed.toUpperCase(), organizationId },
    select: { id: true },
  });
  if (byPublicCode) return byPublicCode;

  const payload = verifyEquipmentQrToken(trimmed);
  if (payload && payload.organizationId === organizationId) {
    const byToken = await prisma.gymEquipment.findFirst({
      where: { id: payload.equipmentId, organizationId },
      select: { id: true },
    });
    if (byToken) return byToken;
  }

  const tokenHash = hashEquipmentToken(trimmed);
  const byHash = await prisma.gymEquipment.findFirst({
    where: { qrTokenHash: tokenHash, organizationId },
    select: { id: true },
  });
  return byHash;
}
