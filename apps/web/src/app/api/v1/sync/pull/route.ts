import { extractDeviceKey } from '@/lib/check-in/device-key';
import { pullMemberCache } from '@/lib/check-in/sync';
import { validateDeviceKey } from '@/lib/api/device-auth';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const deviceKey = extractDeviceKey(request);
  if (!deviceKey) {
    return apiErrorI18n('deviceKeyRequired', 401, request);
  }

  const device = await validateDeviceKey(deviceKey);
  if (!device) {
    return apiErrorI18n('deviceKeyInvalid', 401, request);
  }

  const cache = await pullMemberCache(device.organizationId);

  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), status: 'ONLINE' },
  });

  return apiOk(cache);
}
