'use server';

import { requireSuperAdmin } from '@/lib/admin/guards';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import {
  activateSubscriptionFromRequest,
  resendProformaInvoiceEmail,
} from '@/lib/billing/activate';
import { parseBillingSettings, updateBillingRequestStatus } from '@/lib/billing/settings';
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

    const result = await activateSubscriptionFromRequest(
      organizationId,
      requestId,
      session.user.email ?? 'master-admin',
      session.user.id,
    );

    if (!result.ok) {
      return { error: result.error };
    }

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath('/admin/plans');

    if (result.proformaEmail && !result.proformaEmail.ok) {
      return {
        success:
          'Ödeme onaylandı, abonelik aktifleştirildi — ancak proforma e-postası gönderilemedi. Aşağıdan yeniden deneyin.',
      };
    }

    return { success: 'Ödeme onaylandı, abonelik aktifleştirildi. Proforma e-postası gönderildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Onay başarısız.',
    };
  }
}

export async function resendProformaEmail(
  organizationId: string,
  requestId: string,
): Promise<AdminBillingState> {
  try {
    const session = await requireSuperAdmin();

    const result = await resendProformaInvoiceEmail(organizationId, requestId);
    if (!result.ok) {
      return { error: `Proforma yeniden gönderilemedi: ${result.error}` };
    }

    await writeAdminAuditLog({
      actorId: session.user.id!,
      organizationId,
      action: 'PROFORMA_SENT',
      entityType: 'billing_request',
      entityId: requestId,
      metadata: { resend: true, tokenId: result.tokenId },
    });

    revalidatePath(`/admin/organizations/${organizationId}`);
    return { success: 'Proforma e-postası yeniden gönderildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Yeniden gönderim başarısız.',
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
