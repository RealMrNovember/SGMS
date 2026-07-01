'use server';

import { auth } from '@/lib/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AdminTeamState = {
  error?: string;
  success?: string;
  temporaryPassword?: string;
  fieldErrors?: Record<string, string>;
};

const MANAGEABLE_ROLES = ['STAFF', 'TRAINER', 'VIEWER', 'ADMIN'] as const satisfies readonly OrganizationRole[];

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Bu işlem için Master Admin yetkisi gerekir.');
  }
  return session;
}

function revalidateOrg(organizationId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);
  revalidatePath('/admin/audit');
}

const inviteSchema = z.object({
  organizationId: z.string().cuid(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(MANAGEABLE_ROLES),
});

export async function adminInviteTeamMember(
  _prev: AdminTeamState,
  formData: FormData,
): Promise<AdminTeamState> {
  const parsed = inviteSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: 'Form alanlarını kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, name, email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: { where: { organizationId, isActive: true } },
      },
    });

    if (existingUser?.memberships.length) {
      return { fieldErrors: { email: 'Bu kullanıcı zaten bu salonda kayıtlı.' } };
    }

    const tempPassword = `Sgms${randomBytes(3).toString('hex')}!`;
    const passwordHash = await hash(tempPassword, 12);

    await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: normalizedEmail,
            name: name.trim(),
            passwordHash,
            status: 'ACTIVE',
            locale: 'tr',
          },
        }));

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { name: name.trim(), status: 'ACTIVE' },
        });
      }

      const membership = await tx.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          role,
          isActive: true,
          invitedAt: new Date(),
          joinedAt: new Date(),
        },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: existingUser ? 'MEMBER_INVITED' : 'USER_CREATED',
        entityType: 'organization_member',
        entityId: membership.id,
        metadata: {
          email: normalizedEmail,
          role,
          userId: user.id,
          invitedBy: 'master_admin',
        },
      });
    });

    revalidateOrg(organizationId);
    return {
      success: `${name.trim()} eklendi (${role}).`,
      temporaryPassword: existingUser ? undefined : tempPassword,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Personel eklenemedi.' };
  }
}

const roleSchema = z.object({
  organizationId: z.string().cuid(),
  membershipId: z.string().cuid(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'VIEWER']),
});

export async function adminUpdateMemberRole(
  _prev: AdminTeamState,
  formData: FormData,
): Promise<AdminTeamState> {
  const parsed = roleSchema.safeParse({
    organizationId: formData.get('organizationId'),
    membershipId: formData.get('membershipId'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz rol seçimi.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, membershipId, role } = parsed.data;

    const membership = await prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId },
    });

    if (!membership) {
      return { error: 'Personel kaydı bulunamadı.' };
    }

    if (membership.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        return { error: 'Salonda en az bir OWNER kalmalı.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id: membershipId },
        data: { role },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'organization_member',
        entityId: membershipId,
        metadata: { previousRole: membership.role, role, updatedBy: 'master_admin' },
      });
    });

    revalidateOrg(organizationId);
    return { success: `Rol ${role} olarak güncellendi.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Rol güncellenemedi.' };
  }
}

const toggleSchema = z.object({
  organizationId: z.string().cuid(),
  membershipId: z.string().cuid(),
  isActive: z.enum(['true', 'false']),
});

export async function adminToggleMemberActive(
  _prev: AdminTeamState,
  formData: FormData,
): Promise<AdminTeamState> {
  const parsed = toggleSchema.safeParse({
    organizationId: formData.get('organizationId'),
    membershipId: formData.get('membershipId'),
    isActive: formData.get('isActive'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, membershipId, isActive } = parsed.data;
    const nextActive = isActive === 'true';

    const membership = await prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId },
    });

    if (!membership) {
      return { error: 'Personel kaydı bulunamadı.' };
    }

    if (membership.role === 'OWNER' && !nextActive) {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        return { error: 'Son OWNER devre dışı bırakılamaz.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id: membershipId },
        data: { isActive: nextActive },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: nextActive ? 'MEMBER_UPDATED' : 'MEMBER_REMOVED',
        entityType: 'organization_member',
        entityId: membershipId,
        metadata: { isActive: nextActive, role: membership.role, updatedBy: 'master_admin' },
      });
    });

    revalidateOrg(organizationId);
    return { success: nextActive ? 'Personel yeniden aktifleştirildi.' : 'Personel devre dışı bırakıldı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Durum güncellenemedi.' };
  }
}

const rfidSchema = z.object({
  organizationId: z.string().cuid(),
  membershipId: z.string().cuid(),
  rfidTag: z.string().max(64).optional(),
});

export async function adminUpdateStaffRfid(
  _prev: AdminTeamState,
  formData: FormData,
): Promise<AdminTeamState> {
  const parsed = rfidSchema.safeParse({
    organizationId: formData.get('organizationId'),
    membershipId: formData.get('membershipId'),
    rfidTag: String(formData.get('rfidTag') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz RFID değeri.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, membershipId, rfidTag } = parsed.data;

    const membership = await prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId },
    });

    if (!membership) {
      return { error: 'Personel kaydı bulunamadı.' };
    }

    if (rfidTag) {
      const takenMember = await prisma.gymMember.findFirst({
        where: { organizationId, rfidTag },
      });
      const takenStaff = await prisma.organizationMember.findFirst({
        where: { organizationId, rfidTag, NOT: { id: membershipId } },
      });
      if (takenMember || takenStaff) {
        return { error: 'Bu RFID kartı başka bir kayda atanmış.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id: membershipId },
        data: { rfidTag: rfidTag ?? null },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'organization_member',
        entityId: membershipId,
        metadata: { rfidTag: rfidTag ?? null, field: 'rfidTag', updatedBy: 'master_admin' },
      });
    });

    revalidateOrg(organizationId);
    return { success: rfidTag ? 'RFID kartı kaydedildi.' : 'RFID kartı kaldırıldı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'RFID güncellenemedi.' };
  }
}

const resetSchema = z.object({
  organizationId: z.string().cuid(),
  membershipId: z.string().cuid(),
});

export async function adminResetMemberPassword(
  _prev: AdminTeamState,
  formData: FormData,
): Promise<AdminTeamState> {
  const parsed = resetSchema.safeParse({
    organizationId: formData.get('organizationId'),
    membershipId: formData.get('membershipId'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, membershipId } = parsed.data;

    const membership = await prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!membership) {
      return { error: 'Personel kaydı bulunamadı.' };
    }

    const tempPassword = `Reset${randomBytes(4).toString('hex')}!`;
    const passwordHash = await hash(tempPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: membership.userId },
        data: { passwordHash, status: 'ACTIVE' },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: membership.userId,
        metadata: {
          passwordReset: true,
          email: membership.user.email,
          updatedBy: 'master_admin',
        },
      });
    });

    revalidateOrg(organizationId);
    return {
      success: `${membership.user.email} için geçici parola oluşturuldu.`,
      temporaryPassword: tempPassword,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Parola sıfırlanamadı.' };
  }
}
