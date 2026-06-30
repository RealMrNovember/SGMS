import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { issueApiToken } from '@/lib/api/token';
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
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

  if (!user || user.status !== 'ACTIVE' || user.isSuperAdmin) {
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  const valid = await compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return apiErrorI18n('invalidCredentials', 401, request);
  }

  const membership = user.memberships[0] ?? null;
  const gymMember =
    user.gymMemberProfile?.status === 'ACTIVE' ? user.gymMemberProfile : null;

  const tokenScope = resolveLoginScope(parsed.data.scope, membership, gymMember);
  if (!tokenScope) {
    return apiErrorI18n('noApiScope', 403, request);
  }

  const organizationId =
    tokenScope === 'STAFF' ? membership!.organizationId : gymMember!.organizationId;

  if (membership && gymMember && membership.organizationId !== gymMember.organizationId) {
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

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      organizationId,
      action: 'USER_LOGIN',
      entityType: 'api_token',
      entityId: user.id,
      metadata: { scope: tokenScope, source: 'api_v1_auth_login' },
    },
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
