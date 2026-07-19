'use server';

import { auth } from '@/lib/auth';
import { getRequestAuditContext } from '@/lib/audit/logger';
import { getCloudClient } from '@/lib/cloud-sync';
import { createStaffInviteToken } from '@/lib/staff-invite';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { markStaffDeactivated } from '@/lib/api/staff-revoke-cache';
import { assertWithinStaffLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const INVITABLE_ROLES = ['STAFF', 'TRAINER', 'VIEWER'] as const satisfies readonly OrganizationRole[];
const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

const inviteTeamMemberSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    role: z.enum(INVITABLE_ROLES),
    passwordMode: z.enum(['owner_set', 'email_invite']),
    password: z.string().optional(),
  })
  .refine((data) => data.passwordMode !== 'owner_set' || (data.password && data.password.length >= 8), {
    message: 'Parola en az 8 karakter olmalı.',
    path: ['password'],
  });

export type InviteTeamMemberState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<'name' | 'email' | 'role' | 'password', string>>;
};

async function getTenantContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const actorRole = session.user.role;

  if (!organizationId || !actorRole || !MANAGER_ROLES.has(actorRole)) {
    return { error: 'Personel eklemek için OWNER veya ADMIN yetkisi gerekir.' as const };
  }

  return {
    session,
    organizationId,
    actorId: session.user.id,
  };
}

export async function inviteTeamMember(
  _prevState: InviteTeamMemberState,
  formData: FormData,
): Promise<InviteTeamMemberState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = inviteTeamMemberSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
    passwordMode: formData.get('passwordMode') ?? 'email_invite',
    password: formData.get('password') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: InviteTeamMemberState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field as keyof typeof fieldErrors] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { organizationId: context.organizationId, isActive: true },
      },
    },
  });

  if (existingUser?.memberships.length) {
    return { fieldErrors: { email: 'Bu kullanıcı zaten organizasyonda kayıtlı.' } };
  }

  const staffLimitError = await assertWithinStaffLimit(context.organizationId);
  if (staffLimitError) {
    return { error: staffLimitError };
  }

  // Yeni hesap: sahibi bir parola atadıysa doğrudan onu, aksi halde kimsenin
  // bilmediği rastgele bir hash kullanılır — kullanıcı e-postadaki linkle kendi
  // parolasını belirleyene kadar bu hesaba parolayla giriş yapılamaz.
  const passwordHash = await hash(
    data.passwordMode === 'owner_set' ? data.password! : randomBytes(32).toString('hex'),
    12,
  );
  const initialStatus = data.passwordMode === 'owner_set' ? 'ACTIVE' : 'INVITED';

  const newUserId = await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          name: data.name,
          passwordHash,
          status: initialStatus,
          locale: 'tr',
        },
      }));

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { name: data.name, status: 'ACTIVE' },
      });
    }

    await tx.organizationMember.create({
      data: {
        organizationId: context.organizationId,
        userId: user.id,
        role: data.role,
        isActive: true,
        invitedAt: new Date(),
        // E-posta davetinde joinedAt kabul sonrası set edilir (koltuk "bekliyor" görünürlüğü).
        joinedAt: data.passwordMode === 'owner_set' ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_INVITED',
        entityType: 'organization_member',
        entityId: user.id,
        metadata: {
          email,
          role: data.role,
          passwordMode: data.passwordMode,
        },
      },
    });

    return existingUser ? null : user.id;
  });

  revalidatePath('/dashboard/team');

  if (newUserId && data.passwordMode === 'email_invite') {
    const { token } = await createStaffInviteToken(newUserId, context.organizationId);
    const inviteUrl = `${siteConfig.url}/staff-invite?token=${token}`;

    const html = `
      <p>Merhaba ${data.name},</p>
      <p>SGMS üzerinde size bir personel hesabı oluşturuldu. Aşağıdaki bağlantıya tıklayarak
      kendi parolanızı belirleyebilir ve giriş yapabilirsiniz:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Bu bağlantı 7 gün içinde geçerliliğini yitirecektir.</p>
    `.trim();

    const mailResult = await getCloudClient().sendMail({
      to: email,
      subject: 'SGMS — hesabınız oluşturuldu, parolanızı belirleyin',
      html,
      category: 'transactional',
    });

    const ctx = await getRequestAuditContext();
    await prisma.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'STAFF_INVITE_SENT',
        entityType: 'user',
        entityId: newUserId,
        metadata: { email, emailSent: mailResult.ok },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    if (!mailResult.ok) {
      return {
        error: `${data.name} eklendi ama davet e-postası gönderilemedi. Lütfen kendisine ${inviteUrl} bağlantısını manuel iletin.`,
      };
    }

    return { success: `${data.name} eklendi. Parolasını belirlemesi için davet e-postası gönderildi.` };
  }

  return { success: `${data.name} personel olarak eklendi.` };
}

export type StaffInviteActionState = { error?: string; success?: string };

/** Bekleyen daveti yeniden gönderir (eski token'lar iptal edilir). */
export async function resendStaffInvite(membershipId: string): Promise<StaffInviteActionState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { id: membershipId, organizationId: context.organizationId, isActive: true },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });

  if (!membership) {
    return { error: 'Personel kaydı bulunamadı.' };
  }
  if (membership.user.status !== 'INVITED') {
    return { error: 'Yalnızca bekleyen davetler yeniden gönderilebilir.' };
  }

  await prisma.staffInviteToken.updateMany({
    where: {
      userId: membership.userId,
      organizationId: context.organizationId,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  const { token } = await createStaffInviteToken(membership.userId, context.organizationId);
  const inviteUrl = `${siteConfig.url}/staff-invite?token=${token}`;
  const name = membership.user.name ?? membership.user.email;

  const html = `
    <p>Merhaba ${name},</p>
    <p>SGMS personel davetinizi yeniledik. Parolanızı belirlemek için:</p>
    <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    <p>Bu bağlantı 7 gün içinde geçerliliğini yitirecektir.</p>
  `.trim();

  const mailResult = await getCloudClient().sendMail({
    to: membership.user.email,
    subject: 'SGMS — personel davetiniz yenilendi',
    html,
    category: 'transactional',
  });

  const ctx = await getRequestAuditContext();
  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'STAFF_INVITE_SENT',
      entityType: 'user',
      entityId: membership.userId,
      metadata: { email: membership.user.email, emailSent: mailResult.ok, resend: true },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  if (!mailResult.ok) {
    return {
      error: `Davet e-postası gönderilemedi. Bağlantıyı manuel iletin: ${inviteUrl}`,
    };
  }

  revalidatePath('/dashboard/team');
  return { success: 'Davet e-postası yeniden gönderildi.' };
}

/** Bekleyen daveti iptal eder; koltuk limitinden düşer. */
export async function cancelStaffInvite(membershipId: string): Promise<StaffInviteActionState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { id: membershipId, organizationId: context.organizationId, isActive: true },
    include: { user: { select: { id: true, status: true } } },
  });

  if (!membership) {
    return { error: 'Personel kaydı bulunamadı.' };
  }
  if (membership.user.status !== 'INVITED') {
    return { error: 'Yalnızca bekleyen davetler iptal edilebilir.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: membershipId },
      data: { isActive: false },
    });
    await tx.staffInviteToken.updateMany({
      where: {
        userId: membership.userId,
        organizationId: context.organizationId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const otherActive = await tx.organizationMember.count({
      where: {
        userId: membership.userId,
        isActive: true,
        NOT: { id: membershipId },
      },
    });
    // Başka aktif üyelik yoksa davetli hesabı kapat; aksi halde yalnız bu org'dan çıkar.
    if (otherActive === 0 && membership.user.status === 'INVITED') {
      await tx.user.update({
        where: { id: membership.userId },
        data: { status: 'DISABLED' },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_REMOVED',
        entityType: 'organization_member',
        entityId: membership.userId,
        metadata: { reason: 'staff_invite_cancelled' },
      },
    });
  });

  revalidatePath('/dashboard/team');
  return { success: 'Davet iptal edildi; koltuk serbest bırakıldı.' };
}

export type UpdateStaffRfidState = { error?: string; success?: string };

export async function updateStaffRfid(
  _prev: UpdateStaffRfidState,
  formData: FormData,
): Promise<UpdateStaffRfidState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const membershipId = String(formData.get('membershipId') ?? '');
  const rfidTag = String(formData.get('rfidTag') ?? '').trim();

  const membership = await prisma.organizationMember.findFirst({
    where: { id: membershipId, organizationId: context.organizationId },
  });
  if (!membership) {
    return { error: 'Personel kaydı bulunamadı.' };
  }

  if (rfidTag) {
    const takenMember = await prisma.gymMember.findFirst({
      where: { organizationId: context.organizationId, rfidTag },
    });
    const takenStaff = await prisma.organizationMember.findFirst({
      where: {
        organizationId: context.organizationId,
        rfidTag,
        NOT: { id: membershipId },
      },
    });
    if (takenMember || takenStaff) {
      return { error: 'Bu RFID kartı başka bir kayda atanmış.' };
    }
  }

  await prisma.organizationMember.update({
    where: { id: membershipId },
    data: { rfidTag: rfidTag || null },
  });

  revalidatePath('/dashboard/team');
  revalidatePath('/dashboard/check-in');

  return { success: rfidTag ? 'Personel kartı kaydedildi.' : 'Personel kartı kaldırıldı.' };
}

export type RemoveStaffMemberState = { error?: string; success?: string };

/**
 * Bir personeli salon adına çıkarır/devre dışı bırakır (OWNER/ADMIN). Master Admin
 * tarafındaki eşdeğeri: adminToggleMemberActive (actions/admin-team.ts).
 * Bkz. roadmap.md Faz 36.4.
 */
export async function removeStaffMember(
  _prev: RemoveStaffMemberState,
  formData: FormData,
): Promise<RemoveStaffMemberState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const membershipId = String(formData.get('membershipId') ?? '');
  if (!membershipId) {
    return { error: 'Geçersiz istek.' };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { id: membershipId, organizationId: context.organizationId },
  });

  if (!membership) {
    return { error: 'Personel kaydı bulunamadı.' };
  }

  if (membership.role === 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: context.organizationId, role: 'OWNER', isActive: true },
    });
    if (ownerCount <= 1) {
      return { error: 'Son OWNER çıkarılamaz.' };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: membershipId },
      data: { isActive: false, rfidTag: null },
    });

    await tx.staffInviteToken.updateMany({
      where: { userId: membership.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_REMOVED',
        entityType: 'organization_member',
        entityId: membershipId,
        metadata: { role: membership.role },
      },
    });
  });

  await markStaffDeactivated(context.organizationId, membership.userId);

  revalidatePath('/dashboard/team');
  revalidatePath('/dashboard/check-in');

  return { success: 'Personel çıkarıldı.' };
}
