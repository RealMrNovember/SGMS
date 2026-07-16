import type { OrganizationRole } from '@sgms/database';

export const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
export const VOID_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
