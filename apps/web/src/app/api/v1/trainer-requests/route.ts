import { requestTrainerChange } from '@/actions/trainer-requests';
import {
  requireMemberScopedApiContext,
  requireTenantWriteAccess,
  resolveGymMemberFilter,
} from '@/lib/api/guard';
import { isAthleteContext, isStaffContext } from '@/lib/api/auth-context';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { canViewTrainerRequestReason, stripTrainerRequestReason } from '@/lib/trainers/profiles';
import { prisma } from '@/lib/prisma';
import type { TrainerRequestType } from '@sgms/database';

const REQUEST_TYPES = new Set<TrainerRequestType>(['ASSIGN', 'CHANGE', 'REMOVE']);

function serializeRequest(
  row: Awaited<ReturnType<typeof loadRequests>>[number],
  role: string | null | undefined,
) {
  const base = {
    id: row.id,
    gymMemberId: row.gymMemberId,
    requestType: row.requestType,
    preferredTrainerId: row.preferredTrainerId,
    status: row.status,
    requestedById: row.requestedById,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    resultingTrainerId: row.resultingTrainerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    gymMember: {
      id: row.gymMember.id,
      firstName: row.gymMember.firstName,
      lastName: row.gymMember.lastName,
      trainerId: row.gymMember.trainerId,
    },
    preferredTrainer: row.preferredTrainer
      ? { id: row.preferredTrainer.id, name: row.preferredTrainer.name, email: row.preferredTrainer.email }
      : null,
    resultingTrainer: row.resultingTrainer
      ? { id: row.resultingTrainer.id, name: row.resultingTrainer.name, email: row.resultingTrainer.email }
      : null,
    requestedBy: { id: row.requestedBy.id, name: row.requestedBy.name, email: row.requestedBy.email },
    ...(canViewTrainerRequestReason(role) ? { reason: row.reason } : {}),
  };
  return stripTrainerRequestReason(base, role);
}

async function loadRequests(organizationId: string, gymMemberId?: string, status?: string) {
  return prisma.trainerRequest.findMany({
    where: {
      organizationId,
      ...(gymMemberId ? { gymMemberId } : {}),
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true, trainerId: true } },
      preferredTrainer: { select: { id: true, name: true, email: true } },
      resultingTrainer: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;

  if (isAthleteContext(context)) {
    const { limit, cursor } = parseListParams(request);
    const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
      prisma.trainerRequest.findMany({
        where: { organizationId: context.organizationId, gymMemberId: context.gymMemberId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          gymMember: { select: { id: true, firstName: true, lastName: true, trainerId: true } },
          preferredTrainer: { select: { id: true, name: true, email: true } },
          resultingTrainer: { select: { id: true, name: true, email: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
        },
        ...page,
      }),
    );

    return apiOk({
      requests: items.map((row) => serializeRequest(row, context.scope === 'athlete' ? 'ATHLETE' : null)),
      count: items.length,
      hasMore,
      nextCursor,
    });
  }

  const requestedMemberId = url.searchParams.get('gymMemberId');
  const gymMemberFilter = resolveGymMemberFilter(context, requestedMemberId, request);
  if (typeof gymMemberFilter === 'object') {
    return gymMemberFilter.response;
  }

  const role = isStaffContext(context) ? context.role : null;
  const rows = await loadRequests(context.organizationId, gymMemberFilter, status);
  return apiOk({
    requests: rows.map((row) => serializeRequest(row, role)),
    count: rows.length,
  });
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const requestType = typeof body.requestType === 'string' ? body.requestType : '';
  if (!REQUEST_TYPES.has(requestType as TrainerRequestType)) {
    return apiError('requestType ASSIGN, CHANGE veya REMOVE olmalı.', 400);
  }

  const gymMemberId = isAthleteContext(context)
    ? context.gymMemberId
    : typeof body.gymMemberId === 'string'
      ? body.gymMemberId
      : undefined;

  const result = await requestTrainerChange({
    requestType: requestType as TrainerRequestType,
    preferredTrainerId:
      typeof body.preferredTrainerId === 'string' ? body.preferredTrainerId : undefined,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    gymMemberId,
  });

  if (result.error) {
    return apiError(result.error, 400);
  }

  const pending = await prisma.trainerRequest.findFirst({
    where: {
      organizationId: context.organizationId,
      gymMemberId: gymMemberId ?? (isAthleteContext(context) ? context.gymMemberId : undefined),
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true, trainerId: true } },
      preferredTrainer: { select: { id: true, name: true, email: true } },
      resultingTrainer: { select: { id: true, name: true, email: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return apiOk(
    {
      message: result.success,
      request: pending ? serializeRequest(pending, isStaffContext(context) ? context.role : 'ATHLETE') : null,
    },
    201,
  );
}
