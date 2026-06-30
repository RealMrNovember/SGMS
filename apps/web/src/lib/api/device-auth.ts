import { hashDeviceKey } from '@/lib/check-in/device-key';
import { prisma } from '@/lib/prisma';
import type { Device } from '@sgms/database';

export type ValidatedDevice = Pick<
  Device,
  'id' | 'organizationId' | 'name' | 'type' | 'status' | 'hardwareId'
>;

export async function validateDeviceKey(plainKey: string): Promise<ValidatedDevice | null> {
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
