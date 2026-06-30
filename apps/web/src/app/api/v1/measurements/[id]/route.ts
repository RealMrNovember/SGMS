import {
  canReadHealthData,
  requireMemberScopedApiContext,
  requireTenantApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { isStaffContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

async function loadMeasurement(id: string, organizationId: string) {
  return prisma.healthMeasurement.findFirst({
    where: { id, organizationId },
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  if (context.scope === 'staff' && !canReadHealthData(context.role)) {
    return apiErrorI18n('healthAccessDenied', 403, request);
  }

  const { id } = await params;
  const measurement = await loadMeasurement(id, context.organizationId);

  if (!measurement) {
    return apiErrorI18n('measurementNotFound', 404, request);
  }

  if (context.scope === 'athlete' && measurement.gymMemberId !== context.gymMemberId) {
    return apiErrorI18n('ownRecordsOnly', 403, request);
  }

  return apiOk({ measurement });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;
  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (!canReadHealthData(role)) {
    return apiErrorI18n('updateMeasurementForbidden', 403, request);
  }

  const { id } = await params;
  const existing = await loadMeasurement(id, organizationId);
  if (!existing) {
    return apiErrorI18n('measurementNotFound', 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const measurement = await prisma.healthMeasurement.update({
    where: { id },
    data: {
      ...(body.weight != null ? { weight: Number(body.weight) } : {}),
      ...(body.bodyFatPercentage != null
        ? { bodyFatPercentage: Number(body.bodyFatPercentage) }
        : {}),
      ...(body.muscleMass != null ? { muscleMass: Number(body.muscleMass) } : {}),
      ...(body.height != null ? { height: Number(body.height) } : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
      ...(body.measuredAt ? { measuredAt: new Date(String(body.measuredAt)) } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEASUREMENT_ADDED',
      entityType: 'health_measurement',
      entityId: measurement.id,
      metadata: { source: 'api_v1', operation: 'patch' },
    },
  });

  return apiOk({ measurement });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  if (!isStaffContext(authResult.context)) {
    return apiErrorI18n('deleteMeasurementForbidden', 403, request);
  }

  const { organizationId, role, userId } = authResult.context;
  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (!canReadHealthData(role)) {
    return apiErrorI18n('updateMeasurementForbidden', 403, request);
  }

  const { id } = await params;
  const existing = await loadMeasurement(id, organizationId);
  if (!existing) {
    return apiErrorI18n('measurementNotFound', 404, request);
  }

  await prisma.healthMeasurement.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEASUREMENT_ADDED',
      entityType: 'health_measurement',
      entityId: id,
      metadata: { source: 'api_v1', operation: 'delete' },
    },
  });

  return apiOk({ deleted: true, id });
}
