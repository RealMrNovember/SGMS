import {
  canReadHealthData,
  requireMemberScopedApiContext,
  requireTenantWriteAccess,
  resolveGymMemberFilter,
} from '@/lib/api/guard';
import { isAthleteContext, isStaffContext } from '@/lib/api/auth-context';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

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

function parseMeasurementBody(body: Record<string, unknown>) {
  return {
    weight: parseOptionalNumber(body.weight),
    bodyFatPercentage: parseOptionalNumber(body.bodyFatPercentage),
    muscleMass: parseOptionalNumber(body.muscleMass),
    height: parseOptionalNumber(body.height),
    waistCm: parseOptionalNumber(body.waistCm),
    chestCm: parseOptionalNumber(body.chestCm),
    hipCm: parseOptionalNumber(body.hipCm),
    armCm: parseOptionalNumber(body.armCm),
    thighCm: parseOptionalNumber(body.thighCm),
    bodyWaterPercentage: parseOptionalNumber(body.bodyWaterPercentage),
    visceralFatRating: parseOptionalNumber(body.visceralFatRating),
    restingHeartRate: parseOptionalInt(body.restingHeartRate),
  };
}

function hasAnyMeasurementValue(values: ReturnType<typeof parseMeasurementBody>): boolean {
  return Object.values(values).some((value) => value !== null);
}

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  if (context.scope === 'staff' && !canReadHealthData(context.role)) {
    return apiErrorI18n('healthAccessDenied', 403, request);
  }

  const url = new URL(request.url);
  const requestedMemberId = url.searchParams.get('gymMemberId');
  const gymMemberFilter = resolveGymMemberFilter(context, requestedMemberId, request);
  if (typeof gymMemberFilter === 'object') {
    return gymMemberFilter.response;
  }

  const includePhotos = url.searchParams.get('include') === 'photos';
  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.healthMeasurement.findMany({
      where: {
        organizationId: context.organizationId,
        ...(gymMemberFilter ? { gymMemberId: gymMemberFilter } : {}),
      },
      orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      include: includePhotos ? { photos: true } : undefined,
      ...page,
    }),
  );

  return apiOk({ measurements: items, count: items.length, hasMore, nextCursor });
}

export async function POST(request: Request) {
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
    return apiErrorI18n('healthAccessDenied', 403, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  let gymMemberId: string;
  if (isAthleteContext(context)) {
    gymMemberId = context.gymMemberId;
  } else {
    gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
    if (!gymMemberId) {
      return apiErrorI18n('gymMemberIdRequired', 400, request);
    }
  }

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId },
  });

  if (!gymMember) {
    return apiErrorI18n('athleteNotInOrg', 404, request);
  }

  const values = parseMeasurementBody(body);
  if (!hasAnyMeasurementValue(values)) {
    return apiError('En az bir ölçüm değeri gerekli.', 400);
  }

  const measuredAt = body.measuredAt ? new Date(String(body.measuredAt)) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const measurement = await prisma.healthMeasurement.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId,
      ...values,
      notes: typeof body.notes === 'string' ? body.notes : null,
      measuredAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'MEASUREMENT_ADDED',
      entityType: 'health_measurement',
      entityId: measurement.id,
      metadata: { gymMemberId, source: 'api_v1' },
    },
  });

  return apiOk({ measurement }, 201);
}
