'use server';

import { auth } from '@/lib/auth';
import { getRequestAuditContext } from '@/lib/audit/logger';
import {
  appendBillingRequest,
  getPendingBillingRequest,
  parseBillingSettings,
} from '@/lib/billing/settings';
import { withOrgBillingLock } from '@/lib/billing/lock';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { getCloudClient } from '@/lib/cloud-sync';
import { getPlatformPaymentSettings, initiateIyzicoCheckout, initiatePaytrCheckout } from '@/lib/payments/gateway';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import type { Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type BillingActionState = {
  error?: string;
  success?: string;
};

async function requireOwnerContext() {
  const session = await auth();
  if (!session?.user?.organizationId || session.user.isSuperAdmin) {
    throw new Error('Bu işlem için salon sahibi oturumu gerekir.');
  }
  if (!['OWNER', 'ADMIN'].includes(session.user.role ?? '')) {
    throw new Error('Paket ve ödeme işlemleri yalnızca salon sahibi veya admin tarafından yapılabilir.');
  }
  if (session.user.isDemo) {
    throw new Error('Demo hesaplar değişiklik yapamaz. Bu bir inceleme hesabıdır — gerçek kullanım için ücretsiz deneme oluşturun.');
  }
  return session;
}

const requestSchema = z.object({
  planId: z.string().cuid(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  notes: z.string().max(500).optional(),
});

export async function submitBillingRequest(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const parsed = requestSchema.safeParse({
    planId: formData.get('planId'),
    billingCycle: formData.get('billingCycle'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir paket seçin.' };
  }

  try {
    const session = await requireOwnerContext();
    const orgId = session.user.organizationId!;

    const [org, plan, access] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true, name: true, country: true },
      }),
      prisma.plan.findFirst({
        where: { id: parsed.data.planId, isActive: true },
      }),
      resolveSubscriptionAccess(orgId),
    ]);

    if (!org || !plan) {
      return { error: 'Plan bulunamadı.' };
    }

    if (access.mode === 'full' && access.reason === 'paid_active') {
      return { error: 'Aktif aboneliğiniz mevcut. Paket değişikliği için destek ile iletişime geçin.' };
    }

    const amount =
      parsed.data.billingCycle === 'YEARLY'
        ? Number(plan.priceYearly)
        : Number(plan.priceMonthly);

    const lockResult = await withOrgBillingLock(orgId, async (tx) => {
      const freshOrg = await tx.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
      const settings = parseBillingSettings(freshOrg?.settings);
      if (getPendingBillingRequest(settings)) {
        return { error: 'Bekleyen bir ödeme talebiniz var. Onay sonrası panel otomatik açılacaktır.' } as const;
      }

      const nextSettings = appendBillingRequest(settings, {
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        billingCycle: parsed.data.billingCycle,
        amount,
        currency: plan.currency,
        notes: parsed.data.notes?.trim() || undefined,
      });

      await tx.organization.update({
        where: { id: orgId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId: orgId,
          action: 'SUBSCRIPTION_CHANGED',
          entityType: 'subscription',
          metadata: {
            type: 'billing_request',
            planCode: plan.code,
            billingCycle: parsed.data.billingCycle,
            amount,
          },
        },
      });

      return { error: undefined } as const;
    });

    if (lockResult.error) {
      return { error: lockResult.error };
    }

    revalidatePath('/dashboard/billing');
    return {
      success:
        'Ödeme talebiniz alındı. Banka entegrasyonu aktif olana kadar WhatsApp üzerinden de bize ulaşabilirsiniz; onay sonrası paneliniz otomatik açılır.',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Talep gönderilemedi.',
    };
  }
}

const cardCheckoutSchema = z.object({
  planId: z.string().cuid(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

export type CardCheckoutState = {
  error?: string;
};

/**
 * "Kartla öde" — Platform Ödeme Ayarları'nda (Master Admin → Ayarlar → Ödeme)
 * bir sağlayıcı (iyzico/PayTR) tanımlıysa doğrudan o sağlayıcının ödeme sayfasına
 * yönlendirir. Hiçbir sağlayıcı seçilmediyse eski cloud.cicibyte.com akışına düşer.
 */
export async function startCardCheckout(
  _prev: CardCheckoutState,
  formData: FormData,
): Promise<CardCheckoutState> {
  const parsed = cardCheckoutSchema.safeParse({
    planId: formData.get('planId'),
    billingCycle: formData.get('billingCycle'),
  });

  if (!parsed.success) {
    return { error: 'Lütfen geçerli bir paket seçin.' };
  }

  let checkoutUrl: string;

  try {
    const session = await requireOwnerContext();
    const orgId = session.user.organizationId!;

    const [org, plan, gatewaySettings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, slug: true, email: true } }),
      prisma.plan.findFirst({ where: { id: parsed.data.planId, isActive: true } }),
      getPlatformPaymentSettings(),
    ]);

    if (!org || !plan) {
      return { error: 'Plan bulunamadı.' };
    }

    const amount =
      parsed.data.billingCycle === 'YEARLY' ? Number(plan.priceYearly) : Number(plan.priceMonthly);

    if (gatewaySettings.activeGateway !== 'NONE') {
      const lockResult = await withOrgBillingLock<{ error?: string; billingRequestId?: string }>(
        orgId,
        async (tx) => {
        const orgSettingsRow = await tx.organization.findUnique({
          where: { id: orgId },
          select: { settings: true },
        });
        const billingSettings = parseBillingSettings(orgSettingsRow?.settings);
        if (getPendingBillingRequest(billingSettings)) {
          return { error: 'Bekleyen bir ödeme talebiniz var. Onay sonrası panel otomatik açılacaktır.' };
        }

        const nextSettings = appendBillingRequest(billingSettings, {
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          billingCycle: parsed.data.billingCycle,
          amount,
          currency: plan.currency,
        });
        const billingRequestId = nextSettings.billingRequests![0].id;

        await tx.organization.update({
          where: { id: orgId },
          data: { settings: nextSettings as Prisma.InputJsonValue },
        });
        await tx.gatewayCheckoutSession.create({
          data: {
            id: billingRequestId,
            organizationId: orgId,
            billingRequestId,
            gateway: gatewaySettings.activeGateway,
          },
        });

        return { error: undefined, billingRequestId } as const;
      });

      if (lockResult.error || !lockResult.billingRequestId) {
        return { error: lockResult.error ?? 'Ödeme talebi oluşturulamadı.' };
      }

      const billingRequestId = lockResult.billingRequestId;
      const ctx = await getRequestAuditContext();
      const buyer = {
        id: session.user.id,
        name: session.user.name || org.name,
        email: org.email || session.user.email,
        ip: ctx.ipAddress || '85.34.78.112',
      };

      if (gatewaySettings.activeGateway === 'IYZICO') {
        const result = await initiateIyzicoCheckout(gatewaySettings, {
          orderId: billingRequestId,
          amount,
          currency: plan.currency,
          description: `${plan.name} — ${parsed.data.billingCycle === 'YEARLY' ? 'Yıllık' : 'Aylık'}`,
          buyer,
          callbackUrl: `${siteConfig.url}/api/v1/webhooks/iyzico`,
        });
        if (!result.ok) {
          return { error: result.error };
        }
        checkoutUrl = result.paymentPageUrl;
      } else {
        const result = await initiatePaytrCheckout(
          gatewaySettings,
          {
            orderId: billingRequestId,
            amount,
            currency: plan.currency,
            description: `${plan.name} — ${parsed.data.billingCycle === 'YEARLY' ? 'Yıllık' : 'Aylık'}`,
            buyer,
            callbackUrl: `${siteConfig.url}/api/v1/webhooks/paytr`,
          },
          `${siteConfig.url}/dashboard/billing?paytr=ok`,
          `${siteConfig.url}/dashboard/billing?paytr=fail`,
        );
        if (!result.ok) {
          return { error: result.error };
        }
        checkoutUrl = result.iframeUrl;
      }
    } else {
      const result = await getCloudClient().startCheckout({
        tenantSlug: org.slug,
        tenantName: org.name,
        email: org.email,
        planCode: plan.code,
        billingInterval: parsed.data.billingCycle === 'YEARLY' ? 'yearly' : 'monthly',
        amount,
        currency: plan.currency,
        returnUrl: `${siteConfig.url}/dashboard/billing`,
      });

      if (!result.ok || !result.payload?.checkout_url) {
        return { error: result.message || 'Ödeme sayfası oluşturulamadı. Lütfen daha sonra tekrar deneyin.' };
      }

      checkoutUrl = result.payload.checkout_url;
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ödeme başlatılamadı.' };
  }

  redirect(checkoutUrl);
}

export async function getBillingStatusForClient(organizationId: string) {
  const access = await resolveSubscriptionAccess(organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const pending = org ? getPendingBillingRequest(parseBillingSettings(org.settings)) : null;

  return {
    mode: access.mode,
    reason: access.reason,
    daysRemaining: access.daysRemaining,
    planName: access.planName,
    pendingRequest: pending
      ? { id: pending.id, planName: pending.planName, status: pending.status }
      : null,
  };
}
