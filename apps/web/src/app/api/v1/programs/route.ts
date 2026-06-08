import { canManagePrograms, requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import type { ProgramType } from '@sgms/database';

const PROGRAM_TYPES = new Set<ProgramType>(['WORKOUT', 'NUTRITION']);

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;
  const gymMemberId = new URL(request.url).searchParams.get('gymMemberId');

  const programs = await prisma.trainingProgram.findMany({
    where: {
      organizationId,
      ...(gymMemberId ? { gymMemberId } : {}),
      ...(role === 'TRAINER' ? { trainerId: userId } : {}),
    },
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    take: 100,
  });

  return apiOk({ programs, count: programs.length });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;

  const writeBlock = await requireTenantWriteAccess(organizationId);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (!canManagePrograms(role)) {
    return apiError('Program atamak için TRAINER, ADMIN veya OWNER rolü gerekir.', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON gövdesi.', 400);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';

  if (!gymMemberId || !title || !PROGRAM_TYPES.has(type as ProgramType)) {
    return apiError('gymMemberId, title ve type (WORKOUT|NUTRITION) zorunludur.', 400);
  }

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
  });

  if (!gymMember) {
    return apiError('Sporcu bu organizasyonda bulunamadı.', 404);
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
    return apiError('Atanan antrenör bu organizasyonda geçerli değil.', 400);
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
