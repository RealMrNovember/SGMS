'use server';

import { auth } from '@/lib/auth';
import {
  appendBillingRequest,
  getPendingBillingRequest,
  parseBillingSettings,
} from '@/lib/billing/settings';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';
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

    const settings = parseBillingSettings(org.settings);
    if (getPendingBillingRequest(settings)) {
      return { error: 'Bekleyen bir ödeme talebiniz var. Onay sonrası panel otomatik açılacaktır.' };
    }

    const amount =
      parsed.data.billingCycle === 'YEARLY'
        ? Number(plan.priceYearly)
        : Number(plan.priceMonthly);

    const nextSettings = appendBillingRequest(settings, {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      billingCycle: parsed.data.billingCycle,
      amount,
      currency: plan.currency,
      notes: parsed.data.notes?.trim() || undefined,
    });

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: orgId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      }),
      prisma.auditLog.create({
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
      }),
    ]);

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
