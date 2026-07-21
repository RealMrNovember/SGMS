import {
  requireMemberScopedApiContext,
  requireTenantApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { listActiveTrainerProfiles } from '@/lib/trainers/profiles';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const trainers = await listActiveTrainerProfiles(authResult.context.organizationId);
  return apiOk({ trainers, count: trainers.length });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext(request, { roles: ['OWNER', 'ADMIN'] });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, userId } = authResult.context;

  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const trainerUserId = typeof body.userId === 'string' ? body.userId : '';
  if (!trainerUserId) {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId: trainerUserId, role: 'TRAINER', isActive: true },
  });
  if (!membership) {
    return apiErrorI18n('trainerNotValid', 400, request);
  }

  const specialties =
    typeof body.specialties === 'string'
      ? body.specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(body.specialties)
        ? body.specialties.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
        : [];

  const profile = await prisma.trainerProfile.upsert({
    where: { organizationId_userId: { organizationId, userId: trainerUserId } },
    update: {
      bio: typeof body.bio === 'string' ? body.bio.trim() || null : undefined,
      specialties,
      maxMembers:
        typeof body.maxMembers === 'number' && body.maxMembers > 0 ? Math.floor(body.maxMembers) : null,
      isActive: body.isActive !== false,
    },
    create: {
      organizationId,
      userId: trainerUserId,
      bio: typeof body.bio === 'string' ? body.bio.trim() || null : null,
      specialties,
      maxMembers:
        typeof body.maxMembers === 'number' && body.maxMembers > 0 ? Math.floor(body.maxMembers) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'TRAINER_PROFILE_UPDATED',
      entityType: 'trainer_profile',
      entityId: profile.id,
      metadata: { trainerUserId, source: 'api_v1' },
    },
  });

  return apiOk({ profile }, 201);
}
