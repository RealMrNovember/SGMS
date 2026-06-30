import {
  canManagePrograms,
  requireMemberScopedApiContext,
  requireTenantApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { isStaffContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import type { ProgramType } from '@sgms/database';

const PROGRAM_TYPES = new Set<ProgramType>(['WORKOUT', 'NUTRITION']);

type RouteParams = { params: Promise<{ id: string }> };

async function loadProgram(id: string, organizationId: string) {
  return prisma.trainingProgram.findFirst({
    where: { id, organizationId },
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const { id } = await params;
  const program = await loadProgram(id, context.organizationId);

  if (!program) {
    return apiErrorI18n('programNotFound', 404, request);
  }

  if (context.scope === 'athlete' && program.gymMemberId !== context.gymMemberId) {
    return apiErrorI18n('ownProgramsOnly', 403, request);
  }

  if (
    context.scope === 'staff' &&
    context.role === 'TRAINER' &&
    program.trainerId !== context.userId
  ) {
    return apiErrorI18n('programAccessDenied', 403, request);
  }

  return apiOk({ program });
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

  if (!canManagePrograms(role)) {
    return apiErrorI18n('programUpdateRoleRequired', 403, request);
  }

  const { id } = await params;
  const existing = await prisma.trainingProgram.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    return apiErrorI18n('programNotFound', 404, request);
  }

  if (role === 'TRAINER' && existing.trainerId !== userId) {
    return apiErrorI18n('ownProgramsUpdateOnly', 403, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const type =
    typeof body.type === 'string' && PROGRAM_TYPES.has(body.type as ProgramType)
      ? (body.type as ProgramType)
      : undefined;

  const program = await prisma.trainingProgram.update({
    where: { id },
    data: {
      ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
      ...(type ? { type } : {}),
      ...(typeof body.content === 'object' && body.content !== null
        ? { content: body.content }
        : {}),
      ...(body.startDate ? { startDate: new Date(String(body.startDate)) } : {}),
      ...(body.endDate !== undefined
        ? { endDate: body.endDate ? new Date(String(body.endDate)) : null }
        : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
    },
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
  });

  return apiOk({ program });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  if (!isStaffContext(authResult.context)) {
    return apiErrorI18n('programDeleteForbidden', 403, request);
  }

  const { organizationId, role, userId } = authResult.context;
  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (!canManagePrograms(role)) {
    return apiErrorI18n('programDeleteRoleRequired', 403, request);
  }

  const { id } = await params;
  const existing = await prisma.trainingProgram.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    return apiErrorI18n('programNotFound', 404, request);
  }

  if (role === 'TRAINER' && existing.trainerId !== userId) {
    return apiErrorI18n('ownProgramsDeleteOnly', 403, request);
  }

  await prisma.trainingProgram.delete({ where: { id } });

  return apiOk({ deleted: true, id });
}
