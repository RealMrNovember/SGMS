'use server';

import { auth } from '@/lib/auth';
import { generatePlainDeviceKey, hashDeviceKey } from '@/lib/check-in/device-key';
import { prisma } from '@/lib/prisma';
import { assertWithinDeviceLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { DeviceType, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const DEVICE_MANAGER = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export type DeviceFormState = {
  error?: string;
  success?: string;
  apiKey?: string;
};

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  hardwareId: z.string().min(3).max(120),
  location: z.string().max(120).optional().or(z.literal('')),
  type: z.enum(['TURNSTILE', 'KIOSK', 'SCANNER', 'TABLET', 'OTHER']),
});

async function getDeviceAdminContext() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.role) {
    return { error: 'Oturum gerekli.' as const };
  }
  if (!DEVICE_MANAGER.has(session.user.role)) {
    return { error: 'Cihaz kaydı için OWNER veya ADMIN yetkisi gerekir.' as const };
  }
  return {
    organizationId: session.user.organizationId,
    actorId: session.user.id,
  };
}

export async function registerDevice(
  _prev: DeviceFormState,
  formData: FormData,
): Promise<DeviceFormState> {
  const ctx = await getDeviceAdminContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const writeBlock = await getTenantWriteBlockReason(ctx.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const limit = await assertWithinDeviceLimit(ctx.organizationId);
  if (limit) {
    return { error: limit };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    hardwareId: formData.get('hardwareId'),
    location: formData.get('location'),
    type: formData.get('type') ?? 'TURNSTILE',
  });

  if (!parsed.success) {
    return { error: 'Cihaz adı ve donanım kimliği zorunludur.' };
  }

  const plainKey = generatePlainDeviceKey();
  const data = parsed.data;

  try {
    const device = await prisma.device.create({
      data: {
        organizationId: ctx.organizationId,
        name: data.name,
        hardwareId: data.hardwareId,
        location: data.location || null,
        type: data.type as DeviceType,
        status: 'PENDING',
        apiKeyHash: hashDeviceKey(plainKey),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: ctx.actorId,
        action: 'DEVICE_REGISTERED',
        entityType: 'Device',
        entityId: device.id,
        metadata: { name: data.name, hardwareId: data.hardwareId },
      },
    });
  } catch {
    return { error: 'Bu donanım kimliği zaten kayıtlı.' };
  }

  revalidatePath('/dashboard/check-in');
  return {
    success: 'Turnike cihazı kaydedildi. API anahtarını güvenli bir yere kopyalayın.',
    apiKey: plainKey,
  };
}

export async function disableDevice(deviceId: string): Promise<{ error?: string }> {
  const ctx = await getDeviceAdminContext();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const device = await prisma.device.findFirst({
    where: { id: deviceId, organizationId: ctx.organizationId },
  });
  if (!device) {
    return { error: 'Cihaz bulunamadı.' };
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { status: 'DISABLED' },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      action: 'DEVICE_DISABLED',
      entityType: 'Device',
      entityId: deviceId,
    },
  });

  revalidatePath('/dashboard/check-in');
  return {};
}
