'use server';

import { hash } from 'bcryptjs';
import { z } from 'zod';
import { getRequestAuditContext, writeAuditLog } from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';
import { consumeStaffInviteToken, verifyStaffInviteToken } from '@/lib/staff-invite';

export type AcceptStaffInviteState = {
  error?: string;
  success?: string;
};

const schema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Parolalar eşleşmiyor.',
    path: ['passwordConfirmation'],
  });

export async function acceptStaffInvite(
  _prev: AcceptStaffInviteState,
  formData: FormData,
): Promise<AcceptStaffInviteState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Form bilgilerini kontrol edin.' };
  }

  const check = await verifyStaffInviteToken(parsed.data.token);

  if (!check.valid) {
    const message =
      check.reason === 'expired'
        ? 'Bu davetin süresi dolmuş. Lütfen yöneticinizden yeni bir davet isteyin.'
        : check.reason === 'used'
          ? 'Bu davet zaten kullanılmış. Giriş yapmayı deneyin.'
          : 'Geçersiz davet bağlantısı.';
    return { error: message };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: check.userId },
    data: { passwordHash, status: 'ACTIVE' },
  });

  await consumeStaffInviteToken(check.tokenId);

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: check.userId,
    organizationId: null,
    action: 'STAFF_INVITE_ACCEPTED',
    entityType: 'user',
    entityId: check.userId,
    metadata: {},
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { success: 'Parolanız belirlendi. Şimdi giriş yapabilirsiniz.' };
}
