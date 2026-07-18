import { getCloudClient, syncOrganizationToCloud } from '@/lib/cloud-sync';
import { createProformaToken } from '@/lib/billing/proforma';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import type { Prisma } from '@sgms/database';
import { parseBillingSettings, updateBillingRequestStatus } from './settings';

/**
 * Bekleyen bir billingRequest'i onaylayıp aboneliği aktifleştirir. Master Admin'in
 * manuel onayı (approveBillingRequest) ve gateway webhook'ları (iyzico/PayTR ödeme
 * başarılı bildirimi) aynı bu fonksiyonu kullanır.
 */
export async function activateSubscriptionFromRequest(
  organizationId: string,
  requestId: string,
  resolvedBy: string,
  actorId: string | null,
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!org) {
    return { ok: false as const, error: 'Organizasyon bulunamadı.' };
  }

  const settings = parseBillingSettings(org.settings);
  const request = (settings.billingRequests ?? []).find((r) => r.id === requestId);

  if (!request || request.status !== 'pending') {
    return { ok: false as const, error: 'Bekleyen talep bulunamadı.' };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    return { ok: false as const, error: 'Abonelik kaydı yok.' };
  }

  const periodEnd = new Date(
    Date.now() + (request.billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000,
  );

  const nextSettings = updateBillingRequestStatus(settings, requestId, 'approved', resolvedBy);

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
        actorId,
        organizationId,
        action: 'SUBSCRIPTION_STARTED',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: {
          billingRequestId: requestId,
          planCode: request.planCode,
          amount: request.amount,
          approvedBy: resolvedBy,
        },
      },
    }),
  ]);

  await syncOrganizationToCloud(organizationId);
  await sendProformaInvoiceEmail(organizationId, requestId).catch((error) => {
    console.error('[billing] proforma e-postası gönderilemedi:', error);
  });

  return { ok: true as const, request };
}

async function sendProformaInvoiceEmail(organizationId: string, billingRequestId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, email: true },
  });
  if (!org?.email) return;

  const { token } = await createProformaToken(organizationId, billingRequestId);
  const proformaUrl = `${siteConfig.url}/api/v1/proforma/${token}`;

  const html = `
    <p>Merhaba ${org.name},</p>
    <p>Ödemeniz onaylandı, aboneliğiniz aktif edildi. Proforma faturanıza aşağıdaki bağlantıdan
    ulaşabilirsiniz:</p>
    <p><a href="${proformaUrl}">${proformaUrl}</a></p>
    <p>İyi çalışmalar dileriz.</p>
  `.trim();

  await getCloudClient().sendMail({
    to: org.email,
    subject: 'SGMS — Proforma Faturanız',
    html,
    category: 'transactional',
  });
}
