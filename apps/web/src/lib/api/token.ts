import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { ApiTokenScope, OrganizationRole } from '@sgms/database';

export const API_TOKEN_PREFIX = 'sgms_live_';
const DEFAULT_TTL_DAYS = 30;

export function hashApiToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex');
}

export function generatePlainApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

function tokenExpiresAt(): Date {
  const days = Number(process.env.API_TOKEN_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const ttlMs = (Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ttlMs);
}

export type CreateApiTokenInput = {
  userId: string;
  organizationId: string;
  scope: ApiTokenScope;
  gymMemberId?: string | null;
  role?: OrganizationRole | null;
  label?: string;
};

export async function issueApiToken(input: CreateApiTokenInput) {
  const plainToken = generatePlainApiToken();
  const tokenHash = hashApiToken(plainToken);
  const expiresAt = tokenExpiresAt();

  await prisma.apiToken.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      gymMemberId: input.gymMemberId ?? null,
      role: input.role ?? null,
      tokenHash,
      scope: input.scope,
      label: input.label ?? 'api',
      expiresAt,
    },
  });

  return { accessToken: plainToken, expiresAt };
}

export async function revokeApiTokenByPlain(plainToken: string) {
  const tokenHash = hashApiToken(plainToken);
  const record = await prisma.apiToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt) {
    return false;
  }

  await prisma.apiToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return true;
}

export type ValidatedApiToken = {
  id: string;
  userId: string;
  organizationId: string;
  gymMemberId: string | null;
  role: OrganizationRole | null;
  scope: ApiTokenScope;
};

export async function validateApiToken(plainToken: string): Promise<ValidatedApiToken | null> {
  if (!plainToken.startsWith(API_TOKEN_PREFIX)) {
    return null;
  }

  const tokenHash = hashApiToken(plainToken);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      gymMemberId: true,
      role: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await prisma.apiToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: record.id,
    userId: record.userId,
    organizationId: record.organizationId,
    gymMemberId: record.gymMemberId,
    role: record.role,
    scope: record.scope,
  };
}

export function extractBearerToken(request?: Request): string | null {
  if (!request) {
    return null;
  }

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
