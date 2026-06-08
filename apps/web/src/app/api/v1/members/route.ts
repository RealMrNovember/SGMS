import { canManageMembers, requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit } from '@/lib/tenant-access';

export async function GET() {
  const authResult = await requireTenantApiContext();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId } = authResult.context;

  const members = await prisma.gymMember.findMany({
    where: { organizationId },
    include: {
      plan: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    take: 100,
  });

  return apiOk({ members, count: members.length });
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

  if (!canManageMembers(role)) {
    return apiError('Üye oluşturmak için OWNER, ADMIN veya STAFF rolü gerekir.', 403);
  }

  const memberLimitError = await assertWithinMemberLimit(organizationId);
  if (memberLimitError) {
    return apiError(memberLimitError, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON gövdesi.', 400);
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  if (!firstName || !lastName) {
    return apiError('firstName ve lastName zorunludur.', 400);
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
