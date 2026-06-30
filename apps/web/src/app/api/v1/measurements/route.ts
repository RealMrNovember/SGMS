import {

  canReadHealthData,

  requireMemberScopedApiContext,

  requireTenantApiContext,

  requireTenantWriteAccess,

  resolveGymMemberFilter,

} from '@/lib/api/guard';

import { fetchPage, parseListParams } from '@/lib/api/pagination';

import { apiErrorI18n } from '@/lib/api/i18n-errors';

import { apiOk } from '@/lib/api/response';

import { prisma } from '@/lib/prisma';



export async function GET(request: Request) {

  const authResult = await requireMemberScopedApiContext(request);

  if ('response' in authResult) {

    return authResult.response;

  }



  const { context } = authResult;



  if (context.scope === 'staff' && !canReadHealthData(context.role)) {

    return apiErrorI18n('healthAccessDenied', 403, request);

  }



  const requestedMemberId = new URL(request.url).searchParams.get('gymMemberId');

  const gymMemberFilter = resolveGymMemberFilter(context, requestedMemberId, request);

  if (typeof gymMemberFilter === 'object') {

    return gymMemberFilter.response;

  }



  const { limit, cursor } = parseListParams(request);



  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>

    prisma.healthMeasurement.findMany({

      where: {

        organizationId: context.organizationId,

        ...(gymMemberFilter ? { gymMemberId: gymMemberFilter } : {}),

      },

      orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],

      ...page,

    }),

  );



  return apiOk({ measurements: items, count: items.length, hasMore, nextCursor });

}



export async function POST(request: Request) {

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

    return apiErrorI18n('healthAccessDenied', 403, request);

  }



  let body: Record<string, unknown>;

  try {

    body = (await request.json()) as Record<string, unknown>;

  } catch {

    return apiErrorI18n('invalidJson', 400, request);

  }



  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';

  if (!gymMemberId) {

    return apiErrorI18n('gymMemberIdRequired', 400, request);

  }



  const gymMember = await prisma.gymMember.findFirst({

    where: { id: gymMemberId, organizationId },

  });



  if (!gymMember) {

    return apiErrorI18n('athleteNotInOrg', 404, request);

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

      action: 'MEASUREMENT_ADDED',

      entityType: 'health_measurement',

      entityId: measurement.id,

      metadata: { gymMemberId, source: 'api_v1' },

    },

  });



  return apiOk({ measurement }, 201);

}


