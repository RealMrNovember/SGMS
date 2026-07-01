import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { issueApiToken } from '@/lib/api/token';
import {
  getRequestAuditContextFromRequest,
  writeAccessDeniedAudit,
  writeAuditLog,
  writeLoginFailedAudit,
} from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';
import type { ApiTokenScope, OrganizationRole } from '@sgms/database';
import { compare } from 'bcryptjs';
import { z } from 'zod';

const STAFF_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  scope: z.enum(['athlete', 'staff', 'auto']).optional().default('auto'),
  label: z.string().max(64).optional(),
});

type LoginScope = z.infer<typeof loginSchema>['scope'];

function resolveLoginScope(
  requested: LoginScope,
  membership: { role: OrganizationRole; organizationId: string } | null,
  gymMember: { id: string; organizationId: string } | null,
): ApiTokenScope | null {
  if (requested === 'staff') {
    return membership && STAFF_ROLES.has(membership.role) ? 'STAFF' : null;
  }

  if (requested === 'athlete') {
    return gymMember ? 'ATHLETE' : null;
  }

  if (membership && STAFF_ROLES.has(membership.role)) {
    return 'STAFF';
  }

  if (gymMember) {
    return 'ATHLETE';
  }

  return null;
}

export async function POST(request: Request) {
  const ctx = getRequestAuditContextFromRequest(request);
  const path = new URL(request.url).pathname;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    void writeLoginFailedAudit({
      email: typeof (body as { email?: unknown })?.email === 'string'
        ? (body as { email: string }).email.toLowerCase()
        : 'unknown',
      reason: 'invalid_credentials_format',
      source: 'api_v1',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return apiErrorI18n('emailPasswordRequired', 400, request);
  }

  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
      gymMemberProfile: {
        select: { id: true, organizationId: true, status: true },
      },
    },
  });

  if (!user) {
    void writeLoginFailedAudit({
      email,
      reason: 'user_not_found',
      source: 'api_v1',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  if (user.status !== 'ACTIVE') {
    void writeLoginFailedAudit({
      email,
      reason: 'user_inactive',
      actorId: user.id,
      organizationId: user.memberships[0]?.organizationId ?? null,
      source: 'api_v1',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  if (user.isSuperAdmin) {
    void writeLoginFailedAudit({
      email,
      reason: 'super_admin_blocked',
      actorId: user.id,
      source: 'api_v1',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  const valid = await compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    void writeLoginFailedAudit({
      email,
      reason: 'invalid_password',
      actorId: user.id,
      organizationId: user.memberships[0]?.organizationId ?? null,
      source: 'api_v1',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  const membership = user.memberships[0] ?? null;
  const gymMember =
    user.gymMemberProfile?.status === 'ACTIVE' ? user.gymMemberProfile : null;

  const tokenScope = resolveLoginScope(parsed.data.scope, membership, gymMember);
  if (!tokenScope) {
    void writeAccessDeniedAudit({
      path,
      method: 'POST',
      reason: 'no_api_scope',
      actorId: user.id,
      organizationId: membership?.organizationId ?? gymMember?.organizationId ?? null,
      metadata: { email, scope: parsed.data.scope },
    });
    return apiErrorI18n('noApiScope', 403, request);
  }

  const organizationId =
    tokenScope === 'STAFF' ? membership!.organizationId : gymMember!.organizationId;

  if (membership && gymMember && membership.organizationId !== gymMember.organizationId) {
    void writeAccessDeniedAudit({
      path,
      method: 'POST',
      reason: 'org_mismatch',
      actorId: user.id,
      organizationId: membership.organizationId,
      metadata: { email },
    });
    return apiErrorI18n('orgMismatch', 403, request);
  }

  const issued = await issueApiToken({
    userId: user.id,
    organizationId,
    scope: tokenScope,
    gymMemberId: tokenScope === 'ATHLETE' ? gymMember!.id : gymMember?.id ?? null,
    role: tokenScope === 'STAFF' ? membership!.role : null,
    label: parsed.data.label ?? 'mobile',
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  void writeAuditLog({
    actorId: user.id,
    organizationId,
    action: 'USER_LOGIN',
    entityType: 'api_token',
    entityId: user.id,
    metadata: { scope: tokenScope, source: 'api_v1_auth_login' },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return apiOk({
    accessToken: issued.accessToken,
    tokenType: 'Bearer',
    expiresAt: issued.expiresAt.toISOString(),
    scope: tokenScope === 'STAFF' ? 'staff' : 'athlete',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    },
    organizationId,
    gymMemberId: tokenScope === 'ATHLETE' ? gymMember!.id : gymMember?.id ?? null,
    role: tokenScope === 'STAFF' ? membership!.role : null,
  });
}
