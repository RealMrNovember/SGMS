import {
  canManagePrograms,
  requireMemberScopedApiContext,
  requireTenantApiContext,
  requireTenantWriteAccess,
  resolveGymMemberFilter,
} from '@/lib/api/guard';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import type { ProgramType } from '@sgms/database';

const PROGRAM_TYPES = new Set<ProgramType>(['WORKOUT', 'NUTRITION']);

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const requestedMemberId = new URL(request.url).searchParams.get('gymMemberId');
  const gymMemberFilter = resolveGymMemberFilter(context, requestedMemberId, request);
  if (typeof gymMemberFilter === 'object') {
    return gymMemberFilter.response;
  }

  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.trainingProgram.findMany({
      where: {
        organizationId: context.organizationId,
        ...(gymMemberFilter ? { gymMemberId: gymMemberFilter } : {}),
        ...(context.scope === 'staff' && context.role === 'TRAINER'
          ? { trainerId: context.userId }
          : {}),
      },
      include: {
        gymMember: { select: { id: true, firstName: true, lastName: true } },
        trainer: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      ...page,
    }),
  );

  return apiOk({ programs: items, count: items.length, hasMore, nextCursor });
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

  if (!canManagePrograms(role)) {
    return apiErrorI18n('assignProgramRoleRequired', 403, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';

  if (!gymMemberId || !title || !PROGRAM_TYPES.has(type as ProgramType)) {
    return apiErrorI18n('programFieldsRequired', 400, request);
  }

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
  });

  if (!gymMember) {
    return apiErrorI18n('athleteNotInOrg', 404, request);
  }

  const trainerId =
    role === 'TRAINER'
      ? userId
      : typeof body.trainerId === 'string'
        ? body.trainerId
        : gymMember.trainerId ?? userId;

  const trainerMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: trainerId,
      isActive: true,
      role: { in: ['TRAINER', 'ADMIN', 'OWNER'] },
    },
  });

  if (!trainerMembership) {
    return apiErrorI18n('trainerNotValid', 400, request);
  }

  const program = await prisma.trainingProgram.create({
    data: {
      organizationId,
      gymMemberId,
      trainerId,
      title,
      type: type as ProgramType,
      content: typeof body.content === 'object' && body.content !== null ? body.content : {},
      startDate: body.startDate ? new Date(String(body.startDate)) : new Date(),
      endDate: body.endDate ? new Date(String(body.endDate)) : null,
      isActive: body.isActive !== false,
    },
  });

  return apiOk({ program }, 201);
}
