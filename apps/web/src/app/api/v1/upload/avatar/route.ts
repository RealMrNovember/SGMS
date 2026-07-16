import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { canManageMembers, canReadHealthData, requireTenantApiContext } from '@/lib/api/guard';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readAvatarBuffer, uploadAvatar } from '@/lib/storage';
import type { OrganizationRole } from '@sgms/database';

const SELF_AVATAR_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'VIEWER']);

async function resolveUserAvatarTarget(userId: string, organizationId: string | null, request?: Request) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, avatarUrl: true, isSuperAdmin: true },
  });

  if (!user) {
    return { error: apiErrorI18n('userNotFound', 404, request) } as const;
  }

  return {
    entityType: 'user' as const,
    entityId: user.id,
    organizationId: organizationId ?? 'platform',
    previousUrl: user.avatarUrl,
    update: async (url: string) => {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: url },
      });
    },
  };
}

async function resolveGymMemberAvatarTarget(
  gymMemberId: string,
  organizationId: string,
  actorUserId: string,
  role: OrganizationRole | null,
  request?: Request,
) {
  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    select: { id: true, avatarUrl: true, userId: true },
  });

  if (!member) {
    return { error: apiErrorI18n('memberRecordNotFound', 404, request) } as const;
  }

  const isSelf = member.userId === actorUserId;
  const canManage = role != null && (canManageMembers(role) || (role === 'TRAINER' && canReadHealthData(role)));

  if (!isSelf && !canManage) {
    return { error: apiErrorI18n('avatarUpdateForbidden', 403, request) } as const;
  }

  return {
    entityType: 'gym_member' as const,
    entityId: member.id,
    organizationId,
    previousUrl: member.avatarUrl,
    update: async (url: string) => {
      await prisma.gymMember.update({
        where: { id: member.id },
        data: { avatarUrl: url },
      });
    },
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorI18n('unauthorized', 401, request);
  }
  if (session.user.isDemo) {
    return apiErrorI18n('demoWriteBlocked', 403, request);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiErrorI18n('invalidMultipart', 400, request);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return apiErrorI18n('fileRequired', 400, request);
  }

  const fileResult = await readAvatarBuffer(file);
  if (!fileResult.ok) {
    return apiError(fileResult.error, 400);
  }

  const targetType = formData.get('targetType');
  const gymMemberId = formData.get('gymMemberId');
  const requestedUserId = formData.get('userId');

  let target:
    | {
        entityType: 'user' | 'gym_member';
        entityId: string;
        organizationId: string;
        previousUrl: string | null;
        update: (url: string) => Promise<void>;
      }
    | { error: ReturnType<typeof apiError> };

  if (targetType === 'gym_member') {
    if (typeof gymMemberId !== 'string' || !gymMemberId) {
      return apiErrorI18n('gymMemberIdRequired', 400, request);
    }

    if (session.user.gymMemberId === gymMemberId && session.user.organizationId) {
      // Sporcu kendi fotoğrafını yüklüyor — personel API bağlamı gerekmez.
      target = await resolveGymMemberAvatarTarget(
        gymMemberId,
        session.user.organizationId,
        session.user.id,
        null,
        request,
      );
    } else {
      const tenantAuth = await requireTenantApiContext(request);
      if ('response' in tenantAuth) {
        return tenantAuth.response;
      }

      const { organizationId, role, userId } = tenantAuth.context;
      target = await resolveGymMemberAvatarTarget(gymMemberId, organizationId, userId, role, request);
    }
  } else {
    const tenantAuth = await requireTenantApiContext(request);
    if ('response' in tenantAuth) {
      if (session.user.isSuperAdmin) {
        target = await resolveUserAvatarTarget(session.user.id, null, request);
      } else {
        return tenantAuth.response;
      }
    } else {
      const { organizationId, role, userId } = tenantAuth.context;
      const targetUserId =
        typeof requestedUserId === 'string' && requestedUserId && requestedUserId !== userId
          ? requestedUserId
          : userId;

      if (targetUserId !== userId && !canManageMembers(role)) {
        return apiErrorI18n('avatarStaffOnly', 403, request);
      }

      if (targetUserId === userId && !SELF_AVATAR_ROLES.has(role)) {
        return apiErrorI18n('avatarUploadForbidden', 403, request);
      }

      target = await resolveUserAvatarTarget(targetUserId, organizationId, request);
    }
  }

  if ('error' in target) {
    return target.error;
  }

  const uploaded = await uploadAvatar({
    organizationId: target.organizationId,
    entityType: target.entityType,
    entityId: target.entityId,
    buffer: fileResult.buffer,
    mimeType: fileResult.mimeType,
  });

  await target.update(uploaded.url);

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      organizationId: target.organizationId === 'platform' ? null : target.organizationId,
      action: 'SETTINGS_CHANGED',
      entityType: target.entityType,
      entityId: target.entityId,
      metadata: {
        field: 'avatarUrl',
        previous: target.previousUrl,
        next: uploaded.url,
      },
    },
  });

  return apiOk({
    avatarUrl: uploaded.url,
    key: uploaded.key,
    previousUrl: target.previousUrl,
  });
}
