'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { MembershipGroupType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type GroupActionState = {
  error?: string;
  success?: string;
};

async function getStaffContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }
  return { organizationId, actorId: session.user.id };
}

const GROUP_TYPES = ['INDIVIDUAL', 'COUPLE', 'FAMILY', 'CORPORATE'] as const satisfies readonly MembershipGroupType[];

const createGroupSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(GROUP_TYPES),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  companyName: z.string().max(120).optional(),
  billingNotes: z.string().max(2000).optional(),
});

export async function createMembershipGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createGroupSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type') ?? 'FAMILY',
    discountPercent: formData.get('discountPercent') || 0,
    companyName: formData.get('companyName') || undefined,
    billingNotes: formData.get('billingNotes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Grup bilgilerini kontrol edin.' };
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.membershipGroup.create({
      data: {
        organizationId: context.organizationId,
        name: parsed.data.name,
        type: parsed.data.type,
        discountPercent: parsed.data.discountPercent ?? 0,
        companyName: parsed.data.companyName?.trim() || null,
        billingNotes: parsed.data.billingNotes?.trim() || null,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_GROUP_CREATED',
        entityType: 'membership_group',
        entityId: created.id,
        metadata: { name: created.name, type: created.type },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/groups');
  return { success: `"${group.name}" grubu oluşturuldu.` };
}

export async function addMemberToGroup(
  groupId: string,
  gymMemberId: string,
): Promise<GroupActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const [group, member] = await Promise.all([
    prisma.membershipGroup.findFirst({
      where: { id: groupId, organizationId: context.organizationId },
    }),
    prisma.gymMember.findFirst({
      where: { id: gymMemberId, organizationId: context.organizationId },
    }),
  ]);

  if (!group || !member) {
    return { error: 'Grup veya üye bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: { membershipGroupId: group.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_GROUP_UPDATED',
        entityType: 'membership_group',
        entityId: group.id,
        metadata: { action: 'add_member', gymMemberId: member.id },
      },
    });
  });

  revalidatePath('/dashboard/groups');
  revalidatePath(`/dashboard/members/${gymMemberId}`);
  return { success: 'Üye gruba eklendi.' };
}

export async function removeMemberFromGroup(gymMemberId: string): Promise<GroupActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId },
  });
  if (!member?.membershipGroupId) {
    return { error: 'Üye bir gruba bağlı değil.' };
  }

  const groupId = member.membershipGroupId;

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: { membershipGroupId: null },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_GROUP_UPDATED',
        entityType: 'membership_group',
        entityId: groupId,
        metadata: { action: 'remove_member', gymMemberId: member.id },
      },
    });
  });

  revalidatePath('/dashboard/groups');
  revalidatePath(`/dashboard/members/${gymMemberId}`);
  return { success: 'Üye gruptan çıkarıldı.' };
}

const consentSchema = z.object({
  gymMemberId: z.string().cuid(),
  guardianName: z.string().min(2).max(120),
  guardianPhone: z.string().min(7).max(30),
});

export async function guardianConsent(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = consentSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    guardianName: formData.get('guardianName'),
    guardianPhone: formData.get('guardianPhone'),
  });

  if (!parsed.success) {
    return { error: 'Veli bilgilerini kontrol edin.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
  });
  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  await prisma.gymMember.update({
    where: { id: member.id },
    data: {
      guardianName: parsed.data.guardianName.trim(),
      guardianPhone: parsed.data.guardianPhone.trim(),
      guardianConsentAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/dashboard/groups');
  return { success: 'Veli onayı kaydedildi.' };
}
