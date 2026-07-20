import {
  canReadHealthData,
  requireMemberScopedApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { isStaffContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : null;
}

async function loadMeasurement(id: string, organizationId: string, includePhotos: boolean) {
  return prisma.healthMeasurement.findFirst({
    where: { id, organizationId },
    include: includePhotos ? { photos: true } : undefined,
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
  const includePhotos = new URL(request.url).searchParams.get('include') === 'photos';
  const measurement = await loadMeasurement(id, context.organizationId, includePhotos);

  if (!measurement) {
    return apiErrorI18n('measurementNotFound', 404, request);
  }

  if (context.scope === 'athlete' && measurement.gymMemberId !== context.gymMemberId) {
    return apiErrorI18n('ownRecordsOnly', 403, request);
  }

  return apiOk({ measurement });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (isStaffContext(context) && !canReadHealthData(context.role)) {
    return apiErrorI18n('updateMeasurementForbidden', 403, request);
  }

  const { id } = await params;
  const existing = await loadMeasurement(id, context.organizationId, false);
  if (!existing) {
    return apiErrorI18n('measurementNotFound', 404, request);
  }

  if (context.scope === 'athlete' && existing.gymMemberId !== context.gymMemberId) {
    return apiErrorI18n('ownRecordsOnly', 403, request);
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
      ...(body.weight != null ? { weight: parseOptionalNumber(body.weight) } : {}),
      ...(body.bodyFatPercentage != null
        ? { bodyFatPercentage: parseOptionalNumber(body.bodyFatPercentage) }
        : {}),
      ...(body.muscleMass != null ? { muscleMass: parseOptionalNumber(body.muscleMass) } : {}),
      ...(body.height != null ? { height: parseOptionalNumber(body.height) } : {}),
      ...(body.waistCm != null ? { waistCm: parseOptionalNumber(body.waistCm) } : {}),
      ...(body.chestCm != null ? { chestCm: parseOptionalNumber(body.chestCm) } : {}),
      ...(body.hipCm != null ? { hipCm: parseOptionalNumber(body.hipCm) } : {}),
      ...(body.armCm != null ? { armCm: parseOptionalNumber(body.armCm) } : {}),
      ...(body.thighCm != null ? { thighCm: parseOptionalNumber(body.thighCm) } : {}),
      ...(body.bodyWaterPercentage != null
        ? { bodyWaterPercentage: parseOptionalNumber(body.bodyWaterPercentage) }
        : {}),
      ...(body.visceralFatRating != null
        ? { visceralFatRating: parseOptionalNumber(body.visceralFatRating) }
        : {}),
      ...(body.restingHeartRate != null
        ? { restingHeartRate: parseOptionalInt(body.restingHeartRate) }
        : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
      ...(body.measuredAt ? { measuredAt: new Date(String(body.measuredAt)) } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'MEASUREMENT_ADDED',
      entityType: 'health_measurement',
      entityId: measurement.id,
      metadata: { source: 'api_v1', operation: 'patch' },
    },
  });

  return apiOk({ measurement });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireMemberScopedApiContext(request);
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
  const existing = await loadMeasurement(id, organizationId, false);
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
