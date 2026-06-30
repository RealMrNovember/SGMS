import { auth } from '@/lib/auth';
import { apiErrorI18n, apiErrorI18nForLocale, type ApiErrorKey } from '@/lib/api/i18n-errors';
import { extractBearerToken, validateApiToken } from '@/lib/api/token';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import type { NextResponse } from 'next/server';

export type StaffApiContext = {
  scope: 'staff';
  authMethod: 'session' | 'bearer';
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  email: string;
  name: string;
  locale: string;
  gymMemberId: string | null;
};

export type AthleteApiContext = {
  scope: 'athlete';
  authMethod: 'session' | 'bearer';
  userId: string;
  organizationId: string;
  gymMemberId: string;
  email: string;
  name: string;
  locale: string;
};

export type ApiContext = StaffApiContext | AthleteApiContext;

export type ApiGuardSuccess<T extends ApiContext> = { context: T };
export type ApiGuardFailure = { response: NextResponse };
export type ApiGuardResult<T extends ApiContext> = ApiGuardSuccess<T> | ApiGuardFailure;
export type ResolveApiContextResult = ApiGuardFailure | ApiGuardSuccess<ApiContext>;

function isGuardFailure(result: ResolveApiContextResult): result is ApiGuardFailure {
  return 'response' in result;
}

const STAFF_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

function guardError(key: ApiErrorKey, status: number, request?: Request, locale?: string) {
  if (locale) {
    return { response: apiErrorI18nForLocale(key, status, locale) } as const;
  }
  return { response: apiErrorI18n(key, status, request) } as const;
}

async function loadUserBasics(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, locale: true, status: true, isSuperAdmin: true },
  });
}

async function resolveBearerContext(request: Request): Promise<ResolveApiContextResult | null> {
  const plainToken = extractBearerToken(request);
  if (!plainToken) {
    return null;
  }

  const token = await validateApiToken(plainToken);
  if (!token) {
    return guardError('invalidToken', 401, request);
  }

  const user = await loadUserBasics(token.userId);
  if (!user || user.status !== 'ACTIVE' || user.isSuperAdmin) {
    return guardError('invalidTokenUser', 403, request, user?.locale);
  }

  if (token.scope === 'ATHLETE') {
    if (!token.gymMemberId) {
      return guardError('athleteTokenMissing', 403, request, user.locale);
    }

    return {
      context: {
        scope: 'athlete',
        authMethod: 'bearer',
        userId: user.id,
        organizationId: token.organizationId,
        gymMemberId: token.gymMemberId,
        email: user.email,
        name: user.name,
        locale: user.locale,
      },
    };
  }

  if (!token.role || !STAFF_ROLES.has(token.role)) {
    return guardError('invalidStaffToken', 403, request, user.locale);
  }

  return {
    context: {
      scope: 'staff',
      authMethod: 'bearer',
      userId: user.id,
      organizationId: token.organizationId,
      role: token.role,
      email: user.email,
      name: user.name,
      locale: user.locale,
      gymMemberId: token.gymMemberId,
    },
  };
}

async function resolveSessionContext(request?: Request): Promise<ResolveApiContextResult> {
  const session = await auth();
  if (!session?.user) {
    return guardError('unauthorized', 401, request);
  }

  if (session.user.isSuperAdmin) {
    return guardError('superAdminNoTenantApi', 403, request, session.user.locale);
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const gymMemberId = session.user.gymMemberId ?? null;

  if (role && STAFF_ROLES.has(role) && organizationId) {
    return {
      context: {
        scope: 'staff',
        authMethod: 'session',
        userId: session.user.id,
        organizationId,
        role,
        email: session.user.email,
        name: session.user.name,
        locale: session.user.locale,
        gymMemberId,
      },
    };
  }

  if (gymMemberId && organizationId) {
    return {
      context: {
        scope: 'athlete',
        authMethod: 'session',
        userId: session.user.id,
        organizationId,
        gymMemberId,
        email: session.user.email,
        name: session.user.name,
        locale: session.user.locale,
      },
    };
  }

  return guardError('noActiveProfile', 403, request, session.user.locale);
}

export async function resolveApiContext(request?: Request): Promise<ResolveApiContextResult> {
  if (request) {
    const bearerResult = await resolveBearerContext(request);
    if (bearerResult) {
      return bearerResult;
    }
  }

  return resolveSessionContext(request);
}

export function isStaffContext(context: ApiContext): context is StaffApiContext {
  return context.scope === 'staff';
}

export function isAthleteContext(context: ApiContext): context is AthleteApiContext {
  return context.scope === 'athlete';
}

export async function requireStaffApiContext(
  request?: Request,
  options?: { roles?: readonly OrganizationRole[] },
): Promise<ApiGuardResult<StaffApiContext>> {
  const result = await resolveApiContext(request);
  if (isGuardFailure(result)) {
    return result;
  }

  if (!isStaffContext(result.context)) {
    return guardError('staffOnlyApi', 403, request, result.context.locale);
  }

  if (options?.roles && !options.roles.includes(result.context.role)) {
    return guardError('roleForbidden', 403, request, result.context.locale);
  }

  return { context: result.context };
}

export async function requireAthleteApiContext(
  request?: Request,
): Promise<ApiGuardResult<AthleteApiContext>> {
  const result = await resolveApiContext(request);
  if (isGuardFailure(result)) {
    return result;
  }

  if (!isAthleteContext(result.context)) {
    return guardError('athleteOnlyApi', 403, request, result.context.locale);
  }

  return { context: result.context };
}

export async function requireMemberScopedApiContext(
  request?: Request,
): Promise<ApiGuardResult<ApiContext>> {
  const result = await resolveApiContext(request);
  if (isGuardFailure(result)) {
    return result;
  }

  return { context: result.context };
}

export { isGuardFailure };
