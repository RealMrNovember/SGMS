'use server';

import { auth } from '@/lib/auth';
import {
  buildGymMembersCsv,
  buildOrganizationExport,
  type OrganizationExportPayload,
} from '@/lib/privacy/org-export';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'] as const);

export type PrivacyActionState = {
  error?: string;
  success?: string;
};

async function requirePrivacyAdmin() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const userId = session.user.id;

  if (!organizationId || !role || !ADMIN_ROLES.has(role as 'OWNER' | 'ADMIN')) {
    return { error: 'Bu işlem için OWNER veya ADMIN yetkisi gerekir.' as const };
  }

  return { organizationId, userId, role };
}

export async function exportOrganizationData(): Promise<
  { success: true; data: OrganizationExportPayload } | { success: false; error: string }
> {
  const context = await requirePrivacyAdmin();
  if ('error' in context) {
    return { success: false, error: context.error ?? 'Bu işlem için yetkiniz yok.' };
  }

  const data = await buildOrganizationExport(context.organizationId);
  if (!data) {
    return { success: false, error: 'Salon bulunamadı.' };
  }

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'DATA_EXPORT_REQUESTED',
      entityType: 'organization',
      entityId: context.organizationId,
      metadata: {
        memberCount: data.gymMembers.length,
        expenseCount: data.expenses.length,
        transactionCount: data.transactions.length,
        messageCount: data.directMessages.length,
      },
    },
  });

  return { success: true, data };
}

export async function exportOrganizationDataCsv(): Promise<
  { success: true; csv: string; filename: string } | { success: false; error: string }
> {
  const result = await exportOrganizationData();
  if (!result.success) {
    return result;
  }

  const csv = buildGymMembersCsv(result.data);
  const safeName = result.data.organizationName.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const filename = `members_${safeName}_${result.data.exportedAt.slice(0, 10)}.csv`;

  return { success: true, csv, filename };
}

const deletionSchema = z.object({
  reason: z.string().min(10).max(2000),
});

export async function requestAccountDeletion(
  _prev: PrivacyActionState,
  formData: FormData,
): Promise<PrivacyActionState> {
  const context = await requirePrivacyAdmin();
  if ('error' in context) {
    return { error: context.error };
  }

  const parsed = deletionSchema.safeParse({
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: 'Silme talebi için en az 10 karakterlik bir gerekçe girin.' };
  }

  const existing = await prisma.accountDeletionRequest.findFirst({
    where: {
      organizationId: context.organizationId,
      status: 'PENDING',
    },
  });

  if (existing) {
    return { error: 'Bu salon için zaten bekleyen bir hesap silme talebi var.' };
  }

  const org = await prisma.organization.findUnique({
    where: { id: context.organizationId },
    select: { name: true },
  });

  const superAdmins = await prisma.user.findMany({
    where: { isSuperAdmin: true, status: 'ACTIVE' },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const request = await tx.accountDeletionRequest.create({
      data: {
        organizationId: context.organizationId,
        requestedById: context.userId,
        reason: parsed.data.reason,
        status: 'PENDING',
      },
    });

    if (superAdmins.length > 0) {
      await tx.notification.createMany({
        data: superAdmins.map((admin) => ({
          organizationId: context.organizationId,
          userId: admin.id,
          type: 'SYSTEM' as const,
          title: 'Hesap silme talebi',
          body: `${org?.name ?? 'Salon'} için hesap silme talebi gönderildi.`,
          actionUrl: '/admin/organizations',
          metadata: {
            requestId: request.id,
            organizationId: context.organizationId,
          },
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'ACCOUNT_DELETION_REQUESTED',
        entityType: 'account_deletion_request',
        entityId: request.id,
        metadata: { reasonLength: parsed.data.reason.length },
      },
    });
  });

  revalidatePath('/dashboard/settings');

  return {
    success: 'Hesap silme talebiniz alındı. Platform yöneticisi inceleyecektir; veriler hemen silinmez.',
  };
}
