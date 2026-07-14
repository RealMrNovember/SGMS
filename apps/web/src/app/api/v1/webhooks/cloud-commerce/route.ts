import { verifyCloudWebhookSignature } from '@/lib/cloud-webhook';
import { prisma } from '@/lib/prisma';
import { apiError, apiOk } from '@/lib/api/response';

type PaymentSucceededPayload = {
  payment_id: number;
  tenant_slug?: string | null;
  plan?: string | null;
  billing_interval?: 'monthly' | 'yearly' | null;
  amount?: string;
  currency?: string;
};

type PaymentFailedPayload = {
  payment_id: number;
  tenant_slug?: string | null;
  reason?: string;
};

function periodEndFor(billingInterval: string | null | undefined): Date {
  const days = billingInterval === 'yearly' ? 365 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * cloud.cicibyte.com'un WebhookEndpoint sistemi buraya `payment.succeeded` / `payment.failed`
 * olaylarını iter (Faz 16.3) — HMAC imzası CLOUD_WEBHOOK_SECRET ile doğrulanır. Bu, SGMS'in
 * ödeme sonucunu (kart ile ödeme, cloud.cicibyte.com/iyzico üzerinden) polling yapmadan
 * öğrenmesini sağlar; Subscription/Organization durumu burada güncellenir.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-cb-signature');

  if (!verifyCloudWebhookSignature(rawBody, signature)) {
    return apiError('Geçersiz webhook imzası.', 401);
  }

  const event = request.headers.get('x-cb-event');
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON gövdesi.', 400);
  }

  const tenantSlug = typeof payload.tenant_slug === 'string' ? payload.tenant_slug : null;
  if (!tenantSlug) {
    return apiError('tenant_slug eksik.', 422);
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });

  if (!organization) {
    // Bilinmeyen bir tenant için webhook — sessizce 200 dön (Cloud tarafında retry'a gerek yok).
    return apiOk({ handled: false, reason: 'organization_not_found' });
  }

  if (event === 'payment.succeeded') {
    const data = payload as PaymentSucceededPayload;
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' },
    });

    const periodEnd = periodEndFor(data.billing_interval);

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          billingCycle: data.billing_interval === 'yearly' ? 'YEARLY' : 'MONTHLY',
          trialEndsAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: { status: 'ACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        action: 'CLOUD_PAYMENT_SUCCEEDED',
        entityType: 'organization',
        entityId: organization.id,
        metadata: {
          paymentId: data.payment_id,
          plan: data.plan ?? null,
          amount: data.amount ?? null,
          currency: data.currency ?? null,
        },
      },
    });

    const { syncOrganizationToCloud } = await import('@/lib/cloud-sync');
    await syncOrganizationToCloud(organization.id);

    return apiOk({ handled: true });
  }

  if (event === 'payment.failed') {
    const data = payload as PaymentFailedPayload;

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        action: 'CLOUD_PAYMENT_FAILED',
        entityType: 'organization',
        entityId: organization.id,
        metadata: { paymentId: data.payment_id, reason: data.reason ?? null },
      },
    });

    return apiOk({ handled: true });
  }

  return apiOk({ handled: false, reason: 'unknown_event' });
}
