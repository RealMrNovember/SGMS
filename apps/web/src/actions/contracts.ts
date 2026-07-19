'use server';

import { auth } from '@/lib/auth';
import { DEFAULT_CONTRACT_BODY } from '@/lib/contract-pdf';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'] as const);

export type ContractActionState = {
  error?: string;
  success?: string;
};

async function requireContractAdmin() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const role = session.user.role;

  if (!organizationId || !role || !ADMIN_ROLES.has(role as 'OWNER' | 'ADMIN')) {
    return { error: 'Sözleşme şablonu için OWNER veya ADMIN yetkisi gerekir.' as const };
  }

  return { organizationId, userId };
}

export async function ensureDefaultContractTemplate(organizationId: string) {
  const existing = await prisma.contractTemplate.findFirst({
    where: { organizationId, type: 'MEMBERSHIP', isDefault: true },
  });

  if (existing) return existing;

  return prisma.contractTemplate.create({
    data: {
      organizationId,
      name: 'Üyelik Sözleşmesi',
      type: 'MEMBERSHIP',
      bodyText: DEFAULT_CONTRACT_BODY,
      isDefault: true,
      isActive: true,
    },
  });
}

const templateSchema = z.object({
  bodyText: z.string().min(20).max(20000),
  name: z.string().min(2).max(120).optional(),
});

export async function saveContractTemplate(
  _prev: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  const context = await requireContractAdmin();
  if ('error' in context) {
    return { error: context.error };
  }

  const parsed = templateSchema.safeParse({
    bodyText: formData.get('bodyText'),
    name: formData.get('name') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz şablon metni.' };
  }

  const template = await ensureDefaultContractTemplate(context.organizationId);

  await prisma.$transaction(async (tx) => {
    await tx.contractTemplate.update({
      where: { id: template.id },
      data: {
        bodyText: parsed.data.bodyText,
        name: parsed.data.name ?? template.name,
        updatedById: context.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'CONTRACT_TEMPLATE_UPDATED',
        entityType: 'contract_template',
        entityId: template.id,
      },
    });
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/members');

  return { success: 'Sözleşme şablonu kaydedildi.' };
}

export async function logContractPdfGenerated(organizationId: string, userId: string, gymMemberId: string) {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'CONTRACT_PDF_GENERATED',
      entityType: 'gym_member',
      entityId: gymMemberId,
    },
  });
}

export async function getDefaultContractTemplate(organizationId: string) {
  return ensureDefaultContractTemplate(organizationId);
}
