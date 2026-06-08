import { canReadHealthData, requireTenantApiContext } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role } = authResult.context;

  if (!canReadHealthData(role)) {
    return apiError('Sağlık ölçümlerine erişim yetkiniz yok.', 403);
  }

  const gymMemberId = new URL(request.url).searchParams.get('gymMemberId');

  const measurements = await prisma.healthMeasurement.findMany({
    where: {
      organizationId,
      ...(gymMemberId ? { gymMemberId } : {}),
    },
    orderBy: { measuredAt: 'desc' },
    take: 100,
  });

  return apiOk({ measurements, count: measurements.length });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;

  if (!canReadHealthData(role)) {
    return apiError('Ölçüm eklemek için yetkiniz yok.', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON gövdesi.', 400);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  if (!gymMemberId) {
    return apiError('gymMemberId zorunludur.', 400);
  }

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
  });

  if (!gymMember) {
    return apiError('Sporcu bu organizasyonda bulunamadı.', 404);
  }

  const measurement = await prisma.healthMeasurement.create({
    data: {
      organizationId,
      gymMemberId,
      weight: body.weight != null ? Number(body.weight) : null,
      bodyFatPercentage: body.bodyFatPercentage != null ? Number(body.bodyFatPercentage) : null,
      muscleMass: body.muscleMass != null ? Number(body.muscleMass) : null,
      height: body.height != null ? Number(body.height) : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
      measuredAt: body.measuredAt ? new Date(String(body.measuredAt)) : new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEMBER_UPDATED',
      entityType: 'health_measurement',
      entityId: measurement.id,
      metadata: { gymMemberId, source: 'api_v1' },
    },
  });

  return apiOk({ measurement }, 201);
}
