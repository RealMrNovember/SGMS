'use server';

import { isAthleteContext, resolveApiContext } from '@/lib/api/auth-context';
import { getRequestAuditContext, writeAuditLog } from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { compare, hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AthleteProfileActionState = {
  error?: string;
  success?: string;
};

/**
 * `request` verilirse (mobil API route'ları) Bearer token da kabul edilir;
 * verilmezse (web server action) yalnızca çerez tabanlı oturuma bakılır —
 * `resolveApiContext` ikisini de tek yerden çözer (bkz. lib/api/auth-context.ts).
 * Bu sayede aynı iş mantığı hem web hem mobil için tek kaynaktan çalışır.
 */
async function getAthleteProfileContext(request?: Request) {
  const result = await resolveApiContext(request);
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' as const };
  }

  return {
    userId: result.context.userId,
    gymMemberId: result.context.gymMemberId,
    organizationId: result.context.organizationId,
  };
}

const displayNameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function updateOwnDisplayName(
  _prev: AthleteProfileActionState,
  formData: FormData,
  request?: Request,
): Promise<AthleteProfileActionState> {
  const context = await getAthleteProfileContext(request);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = displayNameSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir ad girin.' };
  }

  await prisma.user.update({
    where: { id: context.userId },
    data: { name: parsed.data.name },
  });

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: context.userId,
    organizationId: context.organizationId,
    action: 'MEMBER_UPDATED',
    entityType: 'gym_member',
    entityId: context.gymMemberId,
    metadata: { source: 'self', field: 'name' },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  revalidatePath('/athlete/account');

  return { success: 'Adınız güncellendi.' };
}

const contactInfoSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  birthDate: z.string().trim().optional(),
});

export async function updateOwnContactInfo(
  _prev: AthleteProfileActionState,
  formData: FormData,
  request?: Request,
): Promise<AthleteProfileActionState> {
  const context = await getAthleteProfileContext(request);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = contactInfoSchema.safeParse({
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    birthDate: formData.get('birthDate') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const birthDate = parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined;
  if (birthDate && Number.isNaN(birthDate.getTime())) {
    return { error: 'Geçersiz doğum tarihi.' };
  }

  await prisma.gymMember.update({
    where: { id: context.gymMemberId },
    data: {
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
      ...(birthDate ? { birthDate } : {}),
    },
  });

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: context.userId,
    organizationId: context.organizationId,
    action: 'MEMBER_UPDATED',
    entityType: 'gym_member',
    entityId: context.gymMemberId,
    metadata: { source: 'self', fields: ['phone', 'email', 'birthDate'] },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  revalidatePath('/athlete/account');

  return { success: 'İletişim bilgileriniz güncellendi.' };
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    newPasswordConfirmation: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: 'Yeni parolalar eşleşmiyor.',
    path: ['newPasswordConfirmation'],
  });

export async function changeOwnPassword(
  _prev: AthleteProfileActionState,
  formData: FormData,
  request?: Request,
): Promise<AthleteProfileActionState> {
  const context = await getAthleteProfileContext(request);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    newPasswordConfirmation: formData.get('newPasswordConfirmation'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Form bilgilerini kontrol edin.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return { error: 'Kullanıcı bulunamadı.' };
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: 'Mevcut parola yanlış.' };
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: context.userId },
    data: { passwordHash },
  });

  const ctx = await getRequestAuditContext();
  await writeAuditLog({
    actorId: context.userId,
    organizationId: context.organizationId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'user',
    entityId: context.userId,
    metadata: { source: 'self_service' },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { success: 'Parolanız güncellendi.' };
}
