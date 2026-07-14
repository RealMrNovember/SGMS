'use server';

import { getCloudClient } from '@/lib/cloud-sync';
import { getRequestAuditContext, writeAuditLog } from '@/lib/audit/logger';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
} from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { consumePasswordResetRateLimit } from '@/lib/rate-limit';
import { siteConfig } from '@/lib/site-config';
import { hash } from 'bcryptjs';
import { z } from 'zod';

export type ForgotPasswordState = {
  error?: string;
  success?: string;
};

const GENERIC_SUCCESS =
  'Bu e-posta adresine kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir e-posta adresi girin.' };
  }

  const email = parsed.data.email.toLowerCase();
  const ctx = await getRequestAuditContext();

  const limit = await consumePasswordResetRateLimit(email, ctx.ipAddress ?? 'unknown');
  if (!limit.allowed) {
    return { error: 'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.' };
  }

  // Kullanıcı var mı yok mu — her durumda aynı cevap (e-posta numaralandırma saldırısına karşı).
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.status === 'ACTIVE') {
    const { token } = await createPasswordResetToken(user.id, ctx.ipAddress);
    const resetUrl = `${siteConfig.url}/reset-password?token=${token}`;

    const html = `
      <p>Merhaba ${user.name},</p>
      <p>SGMS hesabınız için bir şifre sıfırlama talebi aldık. Aşağıdaki bağlantıya tıklayarak yeni bir şifre belirleyebilirsiniz:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Bu bağlantı 60 dakika içinde geçerliliğini yitirecektir.</p>
      <p>Bu talebi siz yapmadıysanız, bu e-postayı yok sayabilirsiniz — hesabınızda herhangi bir değişiklik yapılmayacaktır.</p>
    `.trim();

    const mailResult = await getCloudClient().sendMail({
      to: user.email,
      subject: 'SGMS şifre sıfırlama talebi',
      html,
      category: 'password_reset',
    });

    if (!mailResult.ok) {
      console.error('[password-reset] mail relay failed:', user.id, mailResult.message);
    }

    await writeAuditLog({
      actorId: user.id,
      organizationId: null,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'user',
      entityId: user.id,
      metadata: { emailSent: mailResult.ok },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  return { success: GENERIC_SUCCESS };
}

export type ResetPasswordState = {
  error?: string;
  success?: string;
};

const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Parolalar eşleşmiyor.',
    path: ['passwordConfirmation'],
  });

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Form bilgilerini kontrol edin.' };
  }

  const check = await verifyPasswordResetToken(parsed.data.token);

  if (!check.valid) {
    const message =
      check.reason === 'expired'
        ? 'Bu bağlantının süresi dolmuş. Lütfen yeni bir sıfırlama talebi oluşturun.'
        : check.reason === 'used'
          ? 'Bu bağlantı zaten kullanılmış. Lütfen yeni bir sıfırlama talebi oluşturun.'
          : 'Geçersiz bağlantı. Lütfen yeni bir sıfırlama talebi oluşturun.';

    return { error: message };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: check.userId },
    data: { passwordHash },
  });

  await consumePasswordResetToken(check.tokenId);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: check.userId,
    organizationId: null,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'user',
    entityId: check.userId,
    metadata: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { success: 'Parolanız güncellendi. Şimdi yeni parolanızla giriş yapabilirsiniz.' };
}
