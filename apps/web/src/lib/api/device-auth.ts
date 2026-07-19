import { hashDeviceKey } from '@/lib/check-in/device-key';
import { prisma } from '@/lib/prisma';
import type { Device } from '@sgms/database';

export type ValidatedDevice = Pick<
  Device,
  'id' | 'organizationId' | 'name' | 'type' | 'status' | 'hardwareId'
>;

const LIVE_CHECKIN_BLOCKED = new Set(['DISABLED', 'DRAINING']);

/** Canlı check-in için — DISABLED ve DRAINING reddedilir. */
export async function validateDeviceKey(plainKey: string): Promise<ValidatedDevice | null> {
  const apiKeyHash = hashDeviceKey(plainKey);
  const device = await prisma.device.findFirst({
    where: {
      apiKeyHash,
      status: { notIn: ['DISABLED', 'DRAINING'] },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      type: true,
      status: true,
      hardwareId: true,
    },
  });

  return device;
}

/**
 * Offline sync push/pull için — DRAINING kabul edilir (bekleyen paketler boşaltılsın),
 * yalnızca DISABLED reddedilir.
 */
export async function validateDeviceKeyForSync(plainKey: string): Promise<ValidatedDevice | null> {
  const apiKeyHash = hashDeviceKey(plainKey);
  const device = await prisma.device.findFirst({
    where: {
      apiKeyHash,
      status: { not: 'DISABLED' },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      type: true,
      status: true,
      hardwareId: true,
    },
  });

  return device;
}

export function isLiveCheckInBlocked(status: string): boolean {
  return LIVE_CHECKIN_BLOCKED.has(status);
}
