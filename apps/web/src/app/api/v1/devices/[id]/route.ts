import { requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import type { DeviceStatus } from '@sgms/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireTenantApiContext(request, { roles: ['OWNER', 'ADMIN'] });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const existing = await prisma.device.findFirst({
    where: { id, organizationId: context.organizationId },
  });
  if (!existing) {
    return apiErrorI18n('deviceNotFound', 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const data: { name?: string; location?: string | null; status?: DeviceStatus } = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.location === 'string') {
    data.location = body.location.trim() || null;
  }
  if (typeof body.status === 'string') {
    const allowed = new Set<DeviceStatus>(['PENDING', 'ONLINE', 'OFFLINE', 'DRAINING', 'DISABLED']);
    if (allowed.has(body.status as DeviceStatus)) {
      // Canlı check-in kapatırken bekleyen offline veri için önce DRAINING zorunlu;
      // doğrudan DISABLED yalnızca body.force === true ile.
      if (body.status === 'DISABLED' && existing.status !== 'DRAINING' && body.force !== true) {
        data.status = 'DRAINING';
      } else {
        data.status = body.status as DeviceStatus;
      }
    }
  }

  const device = await prisma.device.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      hardwareId: true,
      location: true,
      lastSeenAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: context.organizationId,
      actorId: context.userId,
      action: data.status === 'DISABLED' ? 'DEVICE_DISABLED' : 'DEVICE_UPDATED',
      entityType: 'Device',
      entityId: device.id,
      metadata: data,
    },
  });

  return apiOk({ device });
}
