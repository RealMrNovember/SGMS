import { canManageMembers, requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit } from '@/lib/tenant-access';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId } = authResult.context;
  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.gymMember.findMany({
      where: { organizationId },
      include: {
        plan: { select: { id: true, name: true } },
        trainer: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page,
    }),
  );

  return apiOk({ members: items, count: items.length, hasMore, nextCursor });
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

  if (!canManageMembers(role)) {
    return apiErrorI18n('createMemberRoleRequired', 403, request);
  }

  const memberLimitError = await assertWithinMemberLimit(organizationId);
  if (memberLimitError) {
    return apiError(memberLimitError, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  if (!firstName || !lastName) {
    return apiErrorI18n('firstNameLastNameRequired', 400, request);
  }

  const member = await prisma.gymMember.create({
    data: {
      organizationId,
      firstName,
      lastName,
      nationalId: typeof body.nationalId === 'string' ? body.nationalId : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      email: typeof body.email === 'string' ? body.email.toLowerCase() : null,
      trainerId: typeof body.trainerId === 'string' ? body.trainerId : null,
      planId: typeof body.planId === 'string' ? body.planId : null,
      status: 'ACTIVE',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEMBER_REGISTERED',
      entityType: 'gym_member',
      entityId: member.id,
      metadata: { source: 'api_v1' },
    },
  });

  return apiOk({ member }, 201);
}
