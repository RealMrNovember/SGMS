import {
  AUDIT_CATEGORY_ACTIONS,
  ALL_AUDIT_ACTIONS,
  type AuditCategory,
} from '@/lib/admin/audit-labels';
import type { AuditAction, Prisma } from '@sgms/database';

/** Routine sync noise — hidden by default on the master audit console. */
export const AUDIT_NOISE_ACTIONS: AuditAction[] = ['LICENSE_HEARTBEAT', 'LICENSE_VALIDATED'];

export type AuditLogFilters = {
  q?: string;
  action?: AuditAction;
  category?: AuditCategory;
  organizationId?: string;
  from?: string;
  to?: string;
  /** When true (default), excludes heartbeat / routine license validation spam. */
  hideNoise?: boolean;
};

export { ALL_AUDIT_ACTIONS };

export function buildAuditWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filters.action) {
    and.push({ action: filters.action });
  } else if (filters.category && filters.category !== 'all') {
    and.push({ action: { in: AUDIT_CATEGORY_ACTIONS[filters.category] } });
  }

  if (filters.hideNoise !== false) {
    and.push({ action: { notIn: AUDIT_NOISE_ACTIONS } });
  }

  if (filters.organizationId) {
    and.push({ organizationId: filters.organizationId });
  }

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) {
      createdAt.gte = new Date(filters.from);
    }
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    and.push({ createdAt });
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { entityType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { organization: { name: { contains: q, mode: 'insensitive' } } },
        { organization: { slug: { contains: q, mode: 'insensitive' } } },
        { actor: { name: { contains: q, mode: 'insensitive' } } },
        { actor: { email: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }

  if (!and.length) {
    return {};
  }
  if (and.length === 1) {
    return and[0];
  }
  return { AND: and };
}
