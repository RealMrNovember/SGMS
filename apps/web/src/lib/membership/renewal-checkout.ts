import { randomUUID } from 'crypto';
import { getRequestAuditContext } from '@/lib/audit/logger';
import { initiateIyzicoCheckout, initiatePaytrCheckout } from '@/lib/payments/gateway';
import {
  getActiveTenantCardGateway,
  toIyzicoCredentials,
  toPaytrCredentials,
} from '@/lib/payments/tenant-gateway';
import { computeRenewalPeriod } from '@/lib/membership/dates';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

export type MembershipRenewalResult =
  | { ok: true; checkoutUrl: string }
  | { ok: true; renewedImmediately: true; newEndsAt: string }
  | { ok: false; error: string };

/**
 * Sporcunun kendi kart bilgisiyle **mevcut paketiyle aynı** paketi yeniden
 * satın alarak üyeliğini uzatması (web `/athlete/account` ve mobil ortak
 * kullanır). Faz 36.1'deki (`renewMembership`, personel tarafı) tarih hesabı
 * (`computeRenewalPeriod`) ve Faz 8.7'nin Iyzico/PayTR checkout altyapısı
 * hiç kod tekrarı olmadan yeniden kullanılıyor.
 *
 * **Kritik fark:** Personel akışı ödemeyi beklemeden üyeliği anında uzatır
 * (personel zaten parayı elden/kartla tahsil etmiş kabul edilir). Bu akışta
 * ödeme kartla ve uzaktan (online) yapıldığından, üyelik yalnızca webhook
 * ödemeyi **onayladıktan sonra** uzatılır (bkz. `settleTenantCheckoutSession`)
 * — aksi halde sporcu ödemeyi yarıda bırakırsa üyeliği bedavaya uzamış olurdu.
 */
export async function startMembershipRenewalCheckout(params: {
  organizationId: string;
  gymMemberId: string;
}): Promise<MembershipRenewalResult> {
  const { organizationId, gymMemberId } = params;

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      planId: true,
      membershipEndsAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!member) {
    return { ok: false, error: 'Üye bulunamadı.' };
  }
  if (!member.userId) {
    return { ok: false, error: 'Hesabınız üyelik yenilemesi için uygun değil. Lütfen resepsiyona başvurun.' };
  }
  if (!member.planId) {
    return { ok: false, error: 'Üyeliğinize atanmış bir paket yok. Lütfen resepsiyona başvurun.' };
  }

  const plan = await prisma.gymMembershipPlan.findFirst({
    where: { id: member.planId, organizationId, isActive: true },
  });

  if (!plan) {
    return { ok: false, error: 'Paketiniz artık satışta değil. Lütfen resepsiyona başvurun.' };
  }

  const period = computeRenewalPeriod({
    currentEndsAt: member.membershipEndsAt,
    durationDays: plan.durationDays,
  });

  const planPrice = Number(plan.price.toString());
  const currency = plan.currency || 'TRY';
  const description = `Üyelik yenileme: ${plan.name} (${plan.durationDays} gün)`;

  // Ücretsiz paket — ödeme sağlayıcısına hiç gerek yok, doğrudan uzatılır.
  if (planPrice <= 0) {
    await prisma.$transaction(async (tx) => {
      await tx.gymMember.update({
        where: { id: gymMemberId },
        data: {
          status: 'ACTIVE',
          ...(period.periodStartsAt ? { membershipStartsAt: period.periodStartsAt } : {}),
          membershipEndsAt: period.membershipEndsAt,
          lastReminderSentAt: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: member.userId!,
          organizationId,
          action: 'MEMBER_UPDATED',
          entityType: 'gym_member',
          entityId: gymMemberId,
          metadata: {
            kind: 'membership_renewed',
            planId: plan.id,
            planName: plan.name,
            durationDays: plan.durationDays,
            newEndsAt: period.membershipEndsAt.toISOString(),
            stacked: period.stacked,
            amount: 0,
            source: 'athlete_self_service_free',
          },
        },
      });
    });
    return { ok: true, renewedImmediately: true, newEndsAt: period.membershipEndsAt.toISOString() };
  }

  const gateway = await getActiveTenantCardGateway(organizationId);
  if (!gateway) {
    return { ok: false, error: 'Bu salon için kartla ödeme henüz aktif değil. Lütfen resepsiyona başvurun.' };
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  if (!org) {
    return { ok: false, error: 'Organizasyon bulunamadı.' };
  }

  const checkoutSessionId = randomUUID().replace(/-/g, '');

  const expense = await prisma.expense.create({
    data: {
      organizationId,
      gymMemberId,
      amount: planPrice,
      currency,
      description,
      status: 'OPEN',
      dueDate: period.membershipEndsAt,
      createdById: member.userId,
    },
  });

  await prisma.tenantCheckoutSession.create({
    data: {
      id: checkoutSessionId,
      organizationId,
      gymMemberId,
      expenseId: expense.id,
      gatewayId: gateway.id,
      provider: gateway.provider,
      amount: planPrice,
      currency,
      renewalPlanId: plan.id,
      renewalMembershipStartsAt: period.periodStartsAt,
      renewalMembershipEndsAt: period.membershipEndsAt,
    },
  });

  const ctx = await getRequestAuditContext();
  const buyer = {
    id: gymMemberId,
    name: member.user?.name || `${member.firstName} ${member.lastName}`.trim(),
    email: member.user?.email || member.email || `${gymMemberId}@sgms.local`,
    phone: member.phone,
    ip: ctx.ipAddress || '85.34.78.112',
  };

  if (gateway.provider === 'IYZICO') {
    const result = await initiateIyzicoCheckout(toIyzicoCredentials(gateway), {
      orderId: checkoutSessionId,
      amount: planPrice,
      currency,
      description: `${org.name} — ${description}`,
      buyer,
      callbackUrl: `${siteConfig.url}/api/v1/webhooks/tenant-iyzico?session=${checkoutSessionId}`,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, checkoutUrl: result.paymentPageUrl };
  }

  if (gateway.provider === 'PAYTR') {
    const result = await initiatePaytrCheckout(
      toPaytrCredentials(gateway),
      {
        orderId: checkoutSessionId,
        amount: planPrice,
        currency,
        description: `${org.name} — ${description}`,
        buyer,
        callbackUrl: `${siteConfig.url}/api/v1/webhooks/tenant-paytr`,
      },
      `${siteConfig.url}/athlete/account?renewal=ok`,
      `${siteConfig.url}/athlete/account?renewal=fail`,
    );
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, checkoutUrl: result.iframeUrl };
  }

  return { ok: false, error: 'Desteklenmeyen ödeme sağlayıcısı.' };
}
