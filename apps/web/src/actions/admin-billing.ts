'use server';

import { requireSuperAdmin } from '@/lib/admin/guards';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import {
  parseBillingSettings,
  updateBillingRequestStatus,
} from '@/lib/billing/settings';
import { syncOrganizationToCloud } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';

export type AdminBillingState = {
  error?: string;
  success?: string;
};

export async function approveBillingRequest(
  organizationId: string,
  requestId: string,
): Promise<AdminBillingState> {
  try {
    const session = await requireSuperAdmin();

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    const settings = parseBillingSettings(org.settings);
    const request = (settings.billingRequests ?? []).find((r) => r.id === requestId);

    if (!request || request.status !== 'pending') {
      return { error: 'Bekleyen talep bulunamadı.' };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Abonelik kaydı yok.' };
    }

    const periodEnd = new Date(
      Date.now() +
        (request.billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000,
    );

    const nextSettings = updateBillingRequestStatus(
      settings,
      requestId,
      'approved',
      session.user.email ?? 'master-admin',
    );

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: request.planId,
          status: 'ACTIVE',
          billingCycle: request.billingCycle,
          trialEndsAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      }),
      prisma.organization.update({
        where: { id: organizationId },
        data: {
          status: 'ACTIVE',
          centralLicenseStatus: 'ACTIVE',
          licenseExpiresAt: periodEnd,
          settings: nextSettings as Prisma.InputJsonValue,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'SUBSCRIPTION_STARTED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: {
            billingRequestId: requestId,
            planCode: request.planCode,
            amount: request.amount,
            approvedBy: 'master_admin',
          },
        },
      }),
    ]);

    await syncOrganizationToCloud(organizationId);

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath('/admin/plans');
    return { success: 'Ödeme onaylandı, abonelik aktifleştirildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Onay başarısız.',
    };
  }
}

export async function rejectBillingRequest(
  organizationId: string,
  requestId: string,
): Promise<AdminBillingState> {
  try {
    const session = await requireSuperAdmin();

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    const settings = parseBillingSettings(org.settings);
    const nextSettings = updateBillingRequestStatus(
      settings,
      requestId,
      'rejected',
      session.user.email ?? 'master-admin',
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: nextSettings as Prisma.InputJsonValue },
    });

    await writeAdminAuditLog({
      actorId: session.user.id!,
      organizationId,
      action: 'SUBSCRIPTION_CHANGED',
      entityType: 'billing_request',
      entityId: requestId,
      metadata: { status: 'rejected', rejectedBy: 'master_admin' },
    });

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath('/admin/audit');
    return { success: 'Talep reddedildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'İşlem başarısız.',
    };
  }
}
