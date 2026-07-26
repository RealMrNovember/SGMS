'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole } from '@sgms/database';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const STAFF_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);

export type PortalAccessState = {
  error?: string;
  success?: string;
  temporaryPassword?: string;
};

const schema = z.object({
  gymMemberId: z.string().cuid(),
  email: z.string().email().max(200),
});

function generateTempPassword(): string {
  // Okunabilir geçici parola — sporcu ilk girişte değiştirmeli (v1'de zorunlu değil).
  return `Sg${randomBytes(4).toString('hex')}!`;
}

/**
 * Üyeye mobil/web sporcu portalı girişi oluşturur: User + GymMember.userId bağlar.
 * Seed'deki athlete deseniyle uyumlu (OrganizationMember VIEWER).
 */
export async function createAthletePortalAccess(
  _prev: PortalAccessState,
  formData: FormData,
): Promise<PortalAccessState> {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !STAFF_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' };
  }

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = schema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { error: 'Geçerli bir e-posta girin.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId },
  });
  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }
  if (member.userId) {
    return { error: 'Bu üyenin zaten portal erişimi var.' };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const otherLink = await prisma.gymMember.findFirst({
      where: { userId: existingUser.id },
      select: { id: true },
    });
    if (otherLink) {
      return { error: 'Bu e-posta başka bir sporcu hesabına bağlı.' };
    }

    // Bu e-posta bu salonda zaten OWNER/ADMIN/STAFF/TRAINER ise aşağıdaki upsert
    // onu sessizce VIEWER'a düşürüp panel erişimini kilitlerdi (ör. kendi
    // salonunda antrenman da yapan bir salon sahibi) — bilinçli olarak engellenir.
    const existingMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: existingUser.id } },
    });
    if (existingMembership && existingMembership.role !== 'VIEWER') {
      return { error: 'Bu e-posta bu salonda zaten bir personel hesabına ait. Farklı bir e-posta kullanın.' };
    }
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hash(temporaryPassword, 12);
  const displayName = `${member.firstName} ${member.lastName}`.trim();

  await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          name: displayName,
          passwordHash,
          status: 'ACTIVE',
          isSuperAdmin: false,
          locale: 'tr',
        },
      }));

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { passwordHash, name: displayName, status: 'ACTIVE' },
      });
    }

    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
      update: { role: 'VIEWER', isActive: true },
      create: {
        organizationId,
        userId: user.id,
        role: 'VIEWER',
        isActive: true,
        joinedAt: new Date(),
      },
    });

    await tx.gymMember.update({
      where: { id: member.id },
      data: { userId: user.id, email: member.email || email },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: { kind: 'portal_access_created', email, userId: user.id },
      },
    });
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  return {
    success: `Portal erişimi oluşturuldu. E-posta: ${email}`,
    temporaryPassword,
  };
}
