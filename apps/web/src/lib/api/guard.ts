import { auth } from '@/lib/auth';
import type { OrganizationRole } from '@sgms/database';
import { apiError } from '@/lib/api/response';

export type TenantApiContext = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  email: string;
  name: string;
};

const STAFF_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const TRAINER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'TRAINER']);

export async function requireTenantApiContext(options?: {
  roles?: readonly OrganizationRole[];
}) {
  const session = await auth();

  if (!session?.user) {
    return { response: apiError('Kimlik doğrulama gerekli.', 401) } as const;
  }

  if (session.user.isSuperAdmin) {
    return { response: apiError('Super Admin tenant API uçlarına erişemez.', 403) } as const;
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;

  if (!organizationId || !role) {
    return { response: apiError('Aktif tenant organizasyonu bulunamadı.', 403) } as const;
  }

  if (!STAFF_ROLES.has(role)) {
    return { response: apiError('Bu API için yetkiniz yok.', 403) } as const;
  }

  if (options?.roles && !options.roles.includes(role)) {
    return { response: apiError('Bu işlem için rol yetkiniz yok.', 403) } as const;
  }

  return {
    context: {
      userId: session.user.id,
      organizationId,
      role,
      email: session.user.email,
      name: session.user.name,
    } satisfies TenantApiContext,
  } as const;
}

export function canManageMembers(role: OrganizationRole) {
  return MANAGER_ROLES.has(role);
}

export function canManagePrograms(role: OrganizationRole) {
  return TRAINER_ROLES.has(role);
}

export function canReadHealthData(role: OrganizationRole) {
  return STAFF_ROLES.has(role);
}
