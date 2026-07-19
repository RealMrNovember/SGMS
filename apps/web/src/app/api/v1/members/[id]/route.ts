import { canManageMembers, requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit } from '@/lib/tenant-access';
import type { GymMemberStatus } from '@sgms/database';

const MEMBER_STATUSES = new Set<GymMemberStatus>(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { id } = await params;
  const member = await prisma.gymMember.findFirst({
    where: { id, organizationId: authResult.context.organizationId },
    include: {
      plan: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!member) {
    return apiErrorI18n('memberNotFound', 404, request);
  }

  return apiOk({ member });
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

  if (!canManageMembers(role)) {
    return apiErrorI18n('updateMemberRoleRequired', 403, request);
  }

  const { id } = await params;
  const existing = await prisma.gymMember.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    return apiErrorI18n('memberNotFound', 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const status =
    typeof body.status === 'string' && MEMBER_STATUSES.has(body.status as GymMemberStatus)
      ? (body.status as GymMemberStatus)
      : undefined;

  // INACTIVE → ACTIVE (veya sayılan duruma) reaktivasyonda plan üye limiti uygulanır.
  const countedStatuses = new Set<GymMemberStatus>(['ACTIVE', 'SUSPENDED']);
  if (
    status &&
    countedStatuses.has(status) &&
    existing.status === 'INACTIVE'
  ) {
    const limitError = await assertWithinMemberLimit(organizationId);
    if (limitError) {
      return apiErrorI18n('memberLimitReached', 403, request, { reason: limitError });
    }
  }

  const member = await prisma.gymMember.update({
    where: { id },
    data: {
      ...(typeof body.firstName === 'string' ? { firstName: body.firstName.trim() } : {}),
      ...(typeof body.lastName === 'string' ? { lastName: body.lastName.trim() } : {}),
      ...(typeof body.phone === 'string' ? { phone: body.phone } : {}),
      ...(typeof body.email === 'string' ? { email: body.email.toLowerCase() } : {}),
      ...(typeof body.trainerId === 'string' ? { trainerId: body.trainerId } : {}),
      ...(typeof body.planId === 'string' ? { planId: body.planId } : {}),
      ...(status ? { status } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEMBER_UPDATED',
      entityType: 'gym_member',
      entityId: member.id,
      metadata: { source: 'api_v1' },
    },
  });

  return apiOk({ member });
}

export async function DELETE(request: Request, { params }: RouteParams) {
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
    return apiErrorI18n('deleteMemberRoleRequired', 403, request);
  }

  const { id } = await params;
  const existing = await prisma.gymMember.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    return apiErrorI18n('memberNotFound', 404, request);
  }

  const member = await prisma.gymMember.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'MEMBER_REMOVED',
      entityType: 'gym_member',
      entityId: member.id,
      metadata: { source: 'api_v1', softDelete: true },
    },
  });

  return apiOk({ member, deactivated: true });
}

