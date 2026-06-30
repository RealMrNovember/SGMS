import { generatePlainDeviceKey, hashDeviceKey } from '@/lib/check-in/device-key';
import { requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { assertWithinDeviceLimit } from '@/lib/tenant-access';
import type { DeviceType } from '@sgms/database';

const DEVICE_MANAGER_ROLES = ['OWNER', 'ADMIN', 'STAFF'] as const;

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request, { roles: DEVICE_MANAGER_ROLES });
  if ('response' in authResult) {
    return authResult.response;
  }

  const devices = await prisma.device.findMany({
    where: { organizationId: authResult.context.organizationId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      hardwareId: true,
      location: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return apiOk({ devices, count: devices.length });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext(request, { roles: ['OWNER', 'ADMIN'] });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const limitReason = await assertWithinDeviceLimit(context.organizationId);
  if (limitReason) {
    return apiErrorI18n('deviceLimitReached', 403, request, { reason: limitReason });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const hardwareId = typeof body.hardwareId === 'string' ? body.hardwareId.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : undefined;
  const typeRaw = typeof body.type === 'string' ? body.type : 'TURNSTILE';
  const allowedTypes = new Set<DeviceType>(['TURNSTILE', 'KIOSK', 'SCANNER', 'TABLET', 'OTHER']);
  const type = allowedTypes.has(typeRaw as DeviceType) ? (typeRaw as DeviceType) : 'TURNSTILE';

  if (!name || !hardwareId) {
    return apiErrorI18n('deviceFieldsRequired', 400, request);
  }

  const plainKey = generatePlainDeviceKey();
  const apiKeyHash = hashDeviceKey(plainKey);

  const device = await prisma.device.create({
    data: {
      organizationId: context.organizationId,
      name,
      hardwareId,
      location: location || null,
      type,
      status: 'PENDING',
      apiKeyHash,
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      hardwareId: true,
      location: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'DEVICE_REGISTERED',
      entityType: 'Device',
      entityId: device.id,
      metadata: { name, hardwareId, type },
    },
  });

  return apiOk(
    {
      device,
      apiKey: plainKey,
      warning: 'Store apiKey securely; it is shown only once.',
    },
    201,
  );
}
