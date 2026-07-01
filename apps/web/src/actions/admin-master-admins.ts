'use server';

import { countActiveMasterAdmins } from '@/lib/admin/master-admin-queries';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type MasterAdminState = {
  error?: string;
  success?: string;
  temporaryPassword?: string;
  fieldErrors?: Record<string, string>;
};

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Bu işlem için Master Admin yetkisi gerekir.');
  }
  return session;
}

function revalidateAdminPages() {
  revalidatePath('/admin');
  revalidatePath('/admin/admins');
  revalidatePath('/admin/audit');
}

function generateTempPassword() {
  return `Sgms${randomBytes(4).toString('hex')}!`;
}

async function ensureNotLastActiveAdmin(targetUserId: string, actorId: string) {
  if (targetUserId === actorId) {
    return { error: 'Kendi Master Admin hesabınız üzerinde bu işlemi yapamazsınız.' };
  }

  const remaining = await countActiveMasterAdmins(targetUserId);
  if (remaining === 0) {
    return { error: 'Sistemde en az bir aktif Master Admin kalmalıdır.' };
  }

  return null;
}

async function stripTenantAccess(userId: string) {
  await prisma.$transaction([
    prisma.organizationMember.deleteMany({ where: { userId } }),
    prisma.apiToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.gymMember.updateMany({
      where: { userId },
      data: { userId: null },
    }),
  ]);
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  locale: z.enum(['tr', 'en', 'de', 'fr', 'es', 'ru', 'az']).default('tr'),
  password: z.string().min(8).max(128).optional().or(z.literal('')),
});

export async function createMasterAdmin(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    locale: formData.get('locale') ?? 'tr',
    password: String(formData.get('password') ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    return { error: 'Form alanlarını kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { name, email, locale, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (existing.isSuperAdmin) {
        return { fieldErrors: { email: 'Bu e-posta zaten Master Admin olarak kayıtlı.' } };
      }
      return {
        fieldErrors: {
          email:
            'Bu e-posta başka bir hesapta kullanılıyor. Mevcut kullanıcıyı yükseltmek için "Mevcut hesabı yükselt" bölümünü kullanın.',
        },
      };
    }

    const tempPassword = password || generateTempPassword();
    const passwordHash = await hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
        locale,
      },
    });

    await stripTenantAccess(user.id);

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_CREATED',
      entityType: 'master_admin',
      entityId: user.id,
      metadata: {
        email: normalizedEmail,
        locale,
        createdBy: 'master_admin_panel',
        isSuperAdmin: true,
      },
    });

    revalidateAdminPages();
    return {
      success: `${normalizedEmail} Master Admin olarak eklendi.`,
      temporaryPassword: password ? undefined : tempPassword,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Master Admin eklenemedi.' };
  }
}

const promoteSchema = z.object({
  email: z.string().email(),
});

export async function promoteUserToMasterAdmin(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const parsed = promoteSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: 'Geçerli bir e-posta girin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const normalizedEmail = parsed.data.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: { where: { isActive: true }, select: { organizationId: true } },
      },
    });

    if (!user) {
      return { fieldErrors: { email: 'Kullanıcı bulunamadı.' } };
    }

    if (user.isSuperAdmin) {
      return { fieldErrors: { email: 'Bu kullanıcı zaten Master Admin.' } };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true, status: 'ACTIVE' },
      });
    });

    await stripTenantAccess(user.id);

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'master_admin',
      entityId: user.id,
      metadata: {
        email: normalizedEmail,
        promoted: true,
        removedMemberships: user.memberships.length,
        updatedBy: 'master_admin_panel',
      },
    });

    revalidateAdminPages();
    return { success: `${normalizedEmail} Master Admin yetkisine yükseltildi. Salon üyelikleri kaldırıldı.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Yükseltme başarısız.' };
  }
}

const updateSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(2).max(120),
  locale: z.enum(['tr', 'en', 'de', 'fr', 'es', 'ru', 'az']),
});

export async function updateMasterAdminProfile(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const parsed = updateSchema.safeParse({
    userId: formData.get('userId'),
    name: formData.get('name'),
    locale: formData.get('locale'),
  });

  if (!parsed.success) {
    return { error: 'Profil alanlarını kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, isSuperAdmin: true },
    });

    if (!target) {
      return { error: 'Master Admin bulunamadı.' };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { name: parsed.data.name.trim(), locale: parsed.data.locale },
    });

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'master_admin',
      entityId: target.id,
      metadata: {
        email: target.email,
        name: parsed.data.name.trim(),
        locale: parsed.data.locale,
        updatedBy: 'master_admin_panel',
      },
    });

    revalidateAdminPages();
    return { success: 'Profil güncellendi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Profil güncellenemedi.' };
  }
}

export async function toggleMasterAdminStatus(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const userId = String(formData.get('userId') ?? '');
  const nextStatus = formData.get('status') === 'ACTIVE' ? 'ACTIVE' : 'DISABLED';

  if (!userId) {
    return { error: 'Geçersiz kullanıcı.' };
  }

  try {
    const session = await requireSuperAdmin();
    const target = await prisma.user.findFirst({
      where: { id: userId, isSuperAdmin: true },
    });

    if (!target) {
      return { error: 'Master Admin bulunamadı.' };
    }

    if (nextStatus === 'DISABLED') {
      const guard = await ensureNotLastActiveAdmin(target.id, session.user.id);
      if (guard) return guard;
    }

    if (target.id === session.user.id && nextStatus === 'DISABLED') {
      return { error: 'Kendi hesabınızı devre dışı bırakamazsınız.' };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { status: nextStatus },
    });

    if (nextStatus === 'DISABLED') {
      await prisma.apiToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'master_admin',
      entityId: target.id,
      metadata: {
        email: target.email,
        status: nextStatus,
        updatedBy: 'master_admin_panel',
      },
    });

    revalidateAdminPages();
    return {
      success: nextStatus === 'ACTIVE' ? 'Hesap aktifleştirildi.' : 'Hesap devre dışı bırakıldı.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Durum güncellenemedi.' };
  }
}

export async function resetMasterAdminPassword(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const userId = String(formData.get('userId') ?? '');
  if (!userId) {
    return { error: 'Geçersiz kullanıcı.' };
  }

  try {
    const session = await requireSuperAdmin();
    const target = await prisma.user.findFirst({
      where: { id: userId, isSuperAdmin: true },
    });

    if (!target) {
      return { error: 'Master Admin bulunamadı.' };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'master_admin',
      entityId: target.id,
      metadata: {
        email: target.email,
        passwordReset: true,
        updatedBy: 'master_admin_panel',
      },
    });

    revalidateAdminPages();
    return {
      success: `${target.email} için yeni geçici parola oluşturuldu.`,
      temporaryPassword: tempPassword,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Parola sıfırlanamadı.' };
  }
}

export async function demoteMasterAdmin(
  _prev: MasterAdminState,
  formData: FormData,
): Promise<MasterAdminState> {
  const userId = String(formData.get('userId') ?? '');
  if (!userId) {
    return { error: 'Geçersiz kullanıcı.' };
  }

  try {
    const session = await requireSuperAdmin();
    const target = await prisma.user.findFirst({
      where: { id: userId, isSuperAdmin: true },
    });

    if (!target) {
      return { error: 'Master Admin bulunamadı.' };
    }

    const guard = await ensureNotLastActiveAdmin(target.id, session.user.id);
    if (guard) return guard;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: { isSuperAdmin: false, status: 'DISABLED' },
      }),
      prisma.apiToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await writeAdminAuditLog({
      actorId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'master_admin',
      entityId: target.id,
      metadata: {
        email: target.email,
        demoted: true,
        isSuperAdmin: false,
        updatedBy: 'master_admin_panel',
      },
    });

    revalidateAdminPages();
    return { success: `${target.email} Master Admin yetkisinden çıkarıldı.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Yetki kaldırılamadı.' };
  }
}
