import type { OrganizationRole, Prisma } from '@sgms/database';

/**
 * TRAINER rolü yalnızca kendisine atanmış sporcuları görebilir/yazabilir.
 * OWNER/ADMIN/STAFF için boş nesne döner (org-scoped sorgular değişmez).
 */
export function trainerScopedMemberWhere(
  role: OrganizationRole | string | null | undefined,
  userId: string,
): Pick<Prisma.GymMemberWhereInput, 'trainerId'> {
  return role === 'TRAINER' ? { trainerId: userId } : {};
}
