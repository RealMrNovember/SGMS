'use server';

import { requireSuperAdmin } from '@/lib/admin/guards';
import { resolveDescendantOrganizationIds } from '@/lib/enterprise/hierarchy';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AdminHierarchyActionState = {
  error?: string;
  success?: string;
};

function revalidateHierarchyViews(organizationId: string, extraOrganizationId?: string) {
  revalidatePath(`/admin/organizations/${organizationId}`);
  if (extraOrganizationId) revalidatePath(`/admin/organizations/${extraOrganizationId}`);
}

const setParentSchema = z.object({
  organizationId: z.string().cuid(),
  parentOrganizationId: z.string().cuid().optional().or(z.literal('')),
});

/** Senaryo: "Zafer Spor" zincirinin merkez ofisi, yeni açtığı "Zafer Spor — Kadıköy"
 * şubesini kurumsal ağaca bağlıyor. Döngü oluşmasını (bir düğümü kendi torununa
 * bağlamayı) engellemek için hedef ebeveynin, bu organizasyonun bir alt ağacı
 * olmadığı doğrulanır. */
export async function setOrganizationParent(
  _prev: AdminHierarchyActionState,
  formData: FormData,
): Promise<AdminHierarchyActionState> {
  const parsed = setParentSchema.safeParse({
    organizationId: formData.get('organizationId'),
    parentOrganizationId: formData.get('parentOrganizationId') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Geçersiz seçim.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, parentOrganizationId } = parsed.data;
    const nextParentId = parentOrganizationId || null;

    if (nextParentId === organizationId) {
      return { error: 'Bir organizasyon kendi ebeveyni olamaz.' };
    }

    if (nextParentId) {
      const descendantIds = await resolveDescendantOrganizationIds(organizationId);
      if (descendantIds.includes(nextParentId)) {
        return { error: 'Döngü oluşur: seçilen ebeveyn, bu organizasyonun bir alt şubesi.' };
      }

      const parentExists = await prisma.organization.findUnique({ where: { id: nextParentId } });
      if (!parentExists) {
        return { error: 'Ebeveyn organizasyon bulunamadı.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { parentOrganizationId: nextParentId },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: nextParentId ? 'ORGANIZATION_HIERARCHY_LINKED' : 'ORGANIZATION_HIERARCHY_UNLINKED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { parentOrganizationId: nextParentId, source: 'master_admin' },
        },
      });
    });

    revalidateHierarchyViews(organizationId, nextParentId ?? undefined);
    return {
      success: nextParentId
        ? 'Organizasyon kurumsal hiyerarşiye bağlandı.'
        : 'Organizasyonun ebeveyn bağı kaldırıldı.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'İşlem başarısız.' };
  }
}

const grantHierarchyMemberSchema = z.object({
  organizationId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(['COMPANY_ADMIN', 'REGIONAL_MANAGER']),
});

/** Senaryo: Zafer Spor'un bölge müdürü, kendi bölgesindeki tüm şubelerin konsolide
 * raporlarını görmek istiyor — Master Admin onu bu düğüme REGIONAL_MANAGER olarak atar.
 * Bu, kullanıcının kendi şubesindeki mevcut OrganizationRole yetkisinden bağımsız,
 * ek ve salt-okunur bir görünürlük katmanıdır. */
export async function grantHierarchyMember(
  _prev: AdminHierarchyActionState,
  formData: FormData,
): Promise<AdminHierarchyActionState> {
  const parsed = grantHierarchyMemberSchema.safeParse({
    organizationId: formData.get('organizationId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir e-posta ve rol seçin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return { error: 'Bu e-posta ile kayıtlı bir kullanıcı bulunamadı.' };
    }

    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.hierarchyMember.upsert({
        where: { organizationId_userId: { organizationId, userId: user.id } },
        create: { organizationId, userId: user.id, role, isActive: true },
        update: { role, isActive: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'HIERARCHY_MEMBER_GRANTED',
          entityType: 'hierarchy_member',
          entityId: created.id,
          metadata: { userId: user.id, email: normalizedEmail, role, source: 'master_admin' },
        },
      });

      return created;
    });

    revalidateHierarchyViews(organizationId);
    return { success: `${user.name} bu düğüme "${role}" olarak atandı. (Yetki: ${grant.id})` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Atama yapılamadı.' };
  }
}

const revokeHierarchyMemberSchema = z.object({
  hierarchyMemberId: z.string().cuid(),
  organizationId: z.string().cuid(),
});

export async function revokeHierarchyMember(
  _prev: AdminHierarchyActionState,
  formData: FormData,
): Promise<AdminHierarchyActionState> {
  const parsed = revokeHierarchyMemberSchema.safeParse({
    hierarchyMemberId: formData.get('hierarchyMemberId'),
    organizationId: formData.get('organizationId'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { hierarchyMemberId, organizationId } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.hierarchyMember.update({
        where: { id: hierarchyMemberId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'HIERARCHY_MEMBER_REVOKED',
          entityType: 'hierarchy_member',
          entityId: hierarchyMemberId,
          metadata: { source: 'master_admin' },
        },
      });
    });

    revalidateHierarchyViews(organizationId);
    return { success: 'Yetki kaldırıldı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'İşlem başarısız.' };
  }
}
