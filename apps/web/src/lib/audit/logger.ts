import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { AuditAction, Prisma } from '@sgms/database';

export type WriteAuditInput = {
  actorId?: string | null;
  organizationId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getRequestAuditContextFromRequest(request: Request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null,
    userAgent: request.headers.get('user-agent'),
  };
}

export async function getRequestAuditContext() {
  const headerStore = await headers();
  return {
    ipAddress:
      headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerStore.get('x-real-ip') ??
      null,
    userAgent: headerStore.get('user-agent'),
  };
}

export async function writeAuditLog(input: WriteAuditInput) {
  const ctx = input.ipAddress !== undefined ? null : await getRequestAuditContext();

  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      organizationId: input.organizationId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: input.ipAddress ?? ctx?.ipAddress ?? null,
      userAgent: input.userAgent ?? ctx?.userAgent ?? null,
    },
  });
}

export async function writeLoginFailedAudit(input: {
  email: string;
  reason:
    | 'invalid_credentials_format'
    | 'user_not_found'
    | 'user_inactive'
    | 'invalid_password'
    | 'no_api_scope'
    | 'org_mismatch'
    | 'super_admin_blocked'
    | 'rate_limited';
  organizationId?: string | null;
  actorId?: string | null;
  source: 'web' | 'api_v1' | 'reception';
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return writeAuditLog({
    actorId: input.actorId ?? null,
    organizationId: input.organizationId ?? null,
    action: 'USER_LOGIN_FAILED',
    entityType: 'user',
    entityId: input.actorId ?? undefined,
    metadata: {
      email: input.email,
      reason: input.reason,
      source: input.source,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function writeAccessDeniedAudit(input: {
  path: string;
  method?: string;
  reason: string;
  actorId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return writeAuditLog({
    actorId: input.actorId ?? null,
    organizationId: input.organizationId ?? null,
    action: 'ACCESS_DENIED',
    entityType: 'route',
    entityId: input.path,
    metadata: {
      method: input.method,
      reason: input.reason,
      ...input.metadata,
    },
  });
}

/** @deprecated use writeAuditLog — kept for admin actions */
export async function writeAdminAuditLog(
  input: WriteAuditInput & { actorId: string },
) {
  return writeAuditLog({
    ...input,
    metadata: { ...input.metadata, source: 'master_admin' },
  });
}
