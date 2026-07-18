'use server';

import { compare } from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getRequestAuditContext, writeAuditLog } from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';
import { consumeLoginRateLimit } from '@/lib/rate-limit';
import {
  buildOtpauthUrl,
  generateBackupCodes,
  generateTotpSecret,
  matchBackupCode,
  verifyTotpToken,
} from '@/lib/two-factor';

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Oturum bulunamadı.');
  }
  return session;
}

/**
 * Giriş formu, parola doğrulandıktan sonra TOTP alanını göstermek gerekip
 * gerekmediğini öğrenmek için bunu çağırır. Gerçek güvenlik sınırı yine de
 * NextAuth authorize()'dadır — bu yalnızca arayüz akışını yönlendirir.
 */
export async function checkTwoFactorRequired(email: string, password: string) {
  const ctx = await getRequestAuditContext();
  const normalizedEmail = email.trim().toLowerCase();

  const rateLimit = await consumeLoginRateLimit(normalizedEmail, ctx.ipAddress ?? 'unknown');
  if (!rateLimit.allowed) {
    return { ok: false as const, requiresTotp: false };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { passwordHash: true, status: true, twoFactorEnabledAt: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    return { ok: false as const, requiresTotp: false };
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false as const, requiresTotp: false };
  }

  return { ok: true as const, requiresTotp: Boolean(user.twoFactorEnabledAt) };
}

export async function generateTwoFactorSetup() {
  const session = await requireSession();
  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpauthUrl(session.user.email, secret);
  return { secret, otpauthUrl };
}

const enableSchema = z.object({
  secret: z.string().min(16),
  code: z.string().min(6).max(6),
});

export async function verifyAndEnableTwoFactor(
  input: { secret: string; code: string },
): Promise<{ error: string } | { backupCodes: string[] }> {
  const session = await requireSession();
  const parsed = enableSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Geçersiz doğrulama kodu.' } as const;
  }

  const validToken = verifyTotpToken(parsed.data.code, parsed.data.secret);
  if (!validToken) {
    return { error: 'Kod hatalı ya da süresi dolmuş. Authenticator uygulamanızdaki güncel kodu girin.' } as const;
  }

  const { plain, hashed } = await generateBackupCodes();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { totpSecret: parsed.data.secret, twoFactorEnabledAt: new Date() },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashed.map((codeHash) => ({ userId: session.user.id, codeHash })),
    }),
  ]);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: 'TWO_FACTOR_ENABLED',
    entityType: 'user',
    entityId: session.user.id,
    metadata: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { backupCodes: plain } as const;
}

async function verifyCurrentUserFactor(userId: string, password: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpSecret: true },
  });
  if (!user) return false;

  const passwordValid = await compare(password, user.passwordHash);
  if (!passwordValid) return false;

  if (user.totpSecret && verifyTotpToken(code, user.totpSecret)) {
    return true;
  }

  const backupCodes = await prisma.twoFactorBackupCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });
  const matchedId = await matchBackupCode(code, backupCodes);
  if (matchedId) {
    await prisma.twoFactorBackupCode.update({
      where: { id: matchedId },
      data: { usedAt: new Date() },
    });
    return true;
  }

  return false;
}

export async function disableTwoFactor(
  input: { password: string; code: string },
): Promise<{ error: string } | { success: true }> {
  const session = await requireSession();
  const valid = await verifyCurrentUserFactor(session.user.id, input.password, input.code);
  if (!valid) {
    return { error: 'Parola veya doğrulama kodu hatalı.' } as const;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { totpSecret: null, twoFactorEnabledAt: null },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: session.user.id } }),
  ]);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: 'TWO_FACTOR_DISABLED',
    entityType: 'user',
    entityId: session.user.id,
    metadata: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { success: true } as const;
}

export async function regenerateBackupCodes(
  input: { password: string; code: string },
): Promise<{ error: string } | { backupCodes: string[] }> {
  const session = await requireSession();
  const valid = await verifyCurrentUserFactor(session.user.id, input.password, input.code);
  if (!valid) {
    return { error: 'Parola veya doğrulama kodu hatalı.' } as const;
  }

  const { plain, hashed } = await generateBackupCodes();

  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashed.map((codeHash) => ({ userId: session.user.id, codeHash })),
    }),
  ]);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: session.user.id,
    organizationId: session.user.organizationId,
    action: 'TWO_FACTOR_BACKUP_CODES_REGENERATED',
    entityType: 'user',
    entityId: session.user.id,
    metadata: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { backupCodes: plain } as const;
}
