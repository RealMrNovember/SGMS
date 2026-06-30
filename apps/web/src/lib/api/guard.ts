import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import {
  requireMemberScopedApiContext,
  requireStaffApiContext,
  type StaffApiContext,
} from '@/lib/api/auth-context';
import type { ApiContext } from '@/lib/api/auth-context';

export type TenantApiContext = StaffApiContext;

const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const TRAINER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'TRAINER']);

export async function requireTenantApiContext(
  request?: Request,
  options?: { roles?: readonly OrganizationRole[] },
) {
  return requireStaffApiContext(request, options);
}

export { requireMemberScopedApiContext, requireAthleteApiContext } from '@/lib/api/auth-context';

export function canManageMembers(role: OrganizationRole) {
  return MANAGER_ROLES.has(role);
}

export function canManagePrograms(role: OrganizationRole) {
  return TRAINER_ROLES.has(role);
}

export function canReadHealthData(role: OrganizationRole) {
  return MANAGER_ROLES.has(role) || role === 'TRAINER';
}

export async function requireTenantWriteAccess(organizationId: string, request?: Request) {
  const reason = await getTenantWriteBlockReason(organizationId);
  if (reason) {
    return { response: apiErrorI18n('writeBlocked', 403, request, { reason }) } as const;
  }
  return null;
}

export function resolveGymMemberFilter(
  context: ApiContext,
  requestedGymMemberId: string | null,
  request?: Request,
): string | undefined | { response: ReturnType<typeof apiErrorI18n> } {
  if (context.scope === 'athlete') {
    if (requestedGymMemberId && requestedGymMemberId !== context.gymMemberId) {
      return { response: apiErrorI18n('ownRecordsOnly', 403, request) };
    }
    return context.gymMemberId;
  }

  return requestedGymMemberId ?? undefined;
}
