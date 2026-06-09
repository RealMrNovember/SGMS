import { apiError, apiOk } from '@/lib/api/response';
import { canManageMembers, canReadHealthData, requireTenantApiContext } from '@/lib/api/guard';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readAvatarBuffer, uploadAvatar } from '@/lib/storage';
import type { OrganizationRole } from '@sgms/database';

const SELF_AVATAR_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'VIEWER']);

async function resolveUserAvatarTarget(userId: string, organizationId: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, avatarUrl: true, isSuperAdmin: true },
  });

  if (!user) {
    return { error: apiError('Kullanıcı bulunamadı.', 404) } as const;
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
  role: OrganizationRole,
) {
  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    select: { id: true, avatarUrl: true, userId: true },
  });

  if (!member) {
    return { error: apiError('Üye kaydı bulunamadı veya bu organizasyona ait değil.', 404) } as const;
  }

  const isSelf = member.userId === actorUserId;
  const canManage = canManageMembers(role) || (role === 'TRAINER' && canReadHealthData(role));

  if (!isSelf && !canManage) {
    return { error: apiError('Bu üyenin avatarını güncelleme yetkiniz yok.', 403) } as const;
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
    return apiError('Kimlik doğrulama gerekli.', 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Geçersiz multipart form verisi.', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return apiError('file alanı zorunludur.', 400);
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
      return apiError('gymMemberId zorunludur.', 400);
    }

    const tenantAuth = await requireTenantApiContext();
    if ('response' in tenantAuth) {
      return tenantAuth.response;
    }

    const { organizationId, role, userId } = tenantAuth.context;
    target = await resolveGymMemberAvatarTarget(gymMemberId, organizationId, userId, role);
  } else {
    const tenantAuth = await requireTenantApiContext();
    if ('response' in tenantAuth) {
      if (session.user.isSuperAdmin) {
        target = await resolveUserAvatarTarget(session.user.id, null);
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
        return apiError('Başka bir kullanıcının avatarını yalnızca OWNER, ADMIN veya STAFF güncelleyebilir.', 403);
      }

      if (targetUserId === userId && !SELF_AVATAR_ROLES.has(role)) {
        return apiError('Avatar yükleme yetkiniz yok.', 403);
      }

      target = await resolveUserAvatarTarget(targetUserId, organizationId);
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
