'use server';

import { compare } from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getRequestAuditContext, writeAuditLog } from '@/lib/audit/logger';
import { getCloudClient } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import { consumeLoginRateLimit, consumeTwoFactorRecoveryRateLimit } from '@/lib/rate-limit';
import { siteConfig } from '@/lib/site-config';
import {
  buildOtpauthUrl,
  generateBackupCodes,
  generateTotpSecret,
  matchBackupCode,
  verifyTotpToken,
} from '@/lib/two-factor';
import {
  consumeTwoFactorRecoveryToken,
  createTwoFactorRecoveryToken,
  verifyTwoFactorRecoveryToken,
} from '@/lib/two-factor-recovery';

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

// ---------------------------------------------------------------------------
// E-posta ile 2FA kurtarma — telefonunu ve yedek kodlarını kaybeden bir OWNER/
// ADMIN kendi hesabına kalıcı olarak kilitlenmesin diye. Bkz. roadmap.md Faz 36.3.
// ---------------------------------------------------------------------------

export type TwoFactorRecoveryRequestState = { error?: string; success?: string };

const GENERIC_RECOVERY_SUCCESS =
  'Bu e-posta adresine kayıtlı ve 2FA etkin bir hesap varsa, kurtarma bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.';

const recoveryRequestSchema = z.object({ email: z.string().email() });

export async function requestTwoFactorRecovery(
  _prev: TwoFactorRecoveryRequestState,
  formData: FormData,
): Promise<TwoFactorRecoveryRequestState> {
  const parsed = recoveryRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir e-posta adresi girin.' };
  }

  const email = parsed.data.email.toLowerCase();
  const ctx = await getRequestAuditContext();

  const limit = await consumeTwoFactorRecoveryRateLimit(email, ctx.ipAddress ?? 'unknown');
  if (!limit.allowed) {
    return { error: 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.' };
  }

  // Kullanıcı var mı, 2FA etkin mi — her durumda aynı cevap (e-posta numaralandırma saldırısına karşı).
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === 'ACTIVE' && user.twoFactorEnabledAt) {
    const { token } = await createTwoFactorRecoveryToken(user.id, ctx.ipAddress);
    const recoveryUrl = `${siteConfig.url}/reset-2fa?token=${token}`;

    const html = `
      <p>Merhaba ${user.name},</p>
      <p>SGMS hesabınız için bir 2FA (iki faktörlü doğrulama) sıfırlama talebi aldık. Aşağıdaki
      bağlantıya tıklayarak 2FA'nızı sıfırlayıp yeniden kurabilirsiniz:</p>
      <p><a href="${recoveryUrl}">${recoveryUrl}</a></p>
      <p>Bu bağlantı 60 dakika içinde geçerliliğini yitirecektir.</p>
      <p>Bu talebi siz yapmadıysanız, bu e-postayı yok sayabilirsiniz — hesabınızda herhangi bir
      değişiklik yapılmayacaktır.</p>
    `.trim();

    const mailResult = await getCloudClient().sendMail({
      to: user.email,
      subject: 'SGMS — 2FA sıfırlama talebi',
      html,
      category: 'password_reset',
    });

    if (!mailResult.ok) {
      console.error('[two-factor-recovery] mail relay failed:', user.id, mailResult.message);
    }

    await writeAuditLog({
      actorId: user.id,
      organizationId: null,
      action: 'TWO_FACTOR_DISABLED',
      entityType: 'user',
      entityId: user.id,
      metadata: { stage: 'requested', emailSent: mailResult.ok },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  return { success: GENERIC_RECOVERY_SUCCESS };
}

export type CompleteTwoFactorRecoveryState = { error?: string; success?: string };

const completeRecoverySchema = z.object({ token: z.string().min(10) });

export async function completeTwoFactorRecovery(
  _prev: CompleteTwoFactorRecoveryState,
  formData: FormData,
): Promise<CompleteTwoFactorRecoveryState> {
  const parsed = completeRecoverySchema.safeParse({ token: formData.get('token') });
  if (!parsed.success) {
    return { error: 'Geçersiz bağlantı.' };
  }

  const check = await verifyTwoFactorRecoveryToken(parsed.data.token);
  if (!check.valid) {
    const message =
      check.reason === 'expired'
        ? 'Bu bağlantının süresi dolmuş. Lütfen yeni bir kurtarma talebi oluşturun.'
        : check.reason === 'used'
          ? 'Bu bağlantı zaten kullanılmış. Lütfen yeni bir kurtarma talebi oluşturun.'
          : 'Geçersiz bağlantı. Lütfen yeni bir kurtarma talebi oluşturun.';
    return { error: message };
  }

  const user = await prisma.user.findUnique({
    where: { id: check.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return { error: 'Hesap bulunamadı.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, twoFactorEnabledAt: null },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
  ]);

  await consumeTwoFactorRecoveryToken(check.tokenId);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: user.id,
    organizationId: null,
    action: 'TWO_FACTOR_DISABLED',
    entityType: 'user',
    entityId: user.id,
    metadata: { stage: 'completed', recovery: true },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  // Hesap sahibi habersiz kalmasın — kimse onun bilgisi dışında 2FA'sını sıfırlayamasın diye bildirim.
  const notifyHtml = `
    <p>Merhaba ${user.name},</p>
    <p>SGMS hesabınızın iki faktörlü doğrulaması (2FA), e-posta ile kurtarma bağlantısı
    kullanılarak az önce sıfırlandı. Bir sonraki girişinizde 2FA'yı yeniden kurmanız istenecek.</p>
    <p>Bu işlemi siz yapmadıysanız, lütfen derhal bizimle iletişime geçin.</p>
  `.trim();

  await getCloudClient().sendMail({
    to: user.email,
    subject: 'SGMS — 2FA hesabınız sıfırlandı',
    html: notifyHtml,
    category: 'transactional',
  });

  return { success: '2FA sıfırlandı. Şimdi giriş yapıp yeniden kurabilirsiniz.' };
}
