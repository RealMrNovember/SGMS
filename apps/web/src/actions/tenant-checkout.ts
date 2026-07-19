'use server';

import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { getRequestAuditContext } from '@/lib/audit/logger';
import { getMemberOpenBalancesByCurrency } from '@/lib/member-balance';
import { initiateIyzicoCheckout, initiatePaytrCheckout } from '@/lib/payments/gateway';
import {
  getActiveTenantCardGateway,
  toIyzicoCredentials,
  toPaytrCredentials,
} from '@/lib/payments/tenant-gateway';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type TenantCheckoutState = {
  error?: string;
};

const schema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
});

/**
 * Sporcu portalındaki "Kartla Öde" — salonun kendi Iyzico/PayTR ayarları (Faz 8.7)
 * üzerinden açık bakiyeyi (verilen para biriminde) tahsil eder. Faz 16.3'teki
 * `startCardCheckout` ile aynı akış, yalnızca platform yerine tenant sağlayıcısı kullanılır.
 */
export async function startTenantCardCheckout(
  _prev: TenantCheckoutState,
  formData: FormData,
): Promise<TenantCheckoutState> {
  const parsed = schema.safeParse({ currency: formData.get('currency') });
  if (!parsed.success) {
    return { error: 'Geçersiz para birimi.' };
  }
  const currency = parsed.data.currency;

  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  if (session.user.isDemo) {
    return { error: 'Demo hesaplar ödeme yapamaz. Bu bir inceleme hesabıdır.' };
  }

  const organizationId = session.user.organizationId;
  const gymMemberId = session.user.gymMemberId;

  let checkoutUrl: string;

  try {
    const gateway = await getActiveTenantCardGateway(organizationId);
    if (!gateway) {
      return { error: 'Bu salon için kartla ödeme henüz aktif değil. Lütfen resepsiyona başvurun.' };
    }

    const balances = await getMemberOpenBalancesByCurrency(organizationId, gymMemberId);
    const amount = Math.round((balances[currency] ?? 0) * 100) / 100;
    if (amount <= 0) {
      return { error: 'Bu para biriminde açık borcunuz yok.' };
    }

    const [org, member] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.gymMember.findFirst({
        where: { id: gymMemberId, organizationId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    if (!org || !member) {
      return { error: 'Üye bulunamadı.' };
    }

    // Not: id kasıtlı olarak tire (-) içermez — PayTR `merchant_oid` alanında yalnızca
    // alfanümerik karakter kabul eder ve gönderim sırasında tireleri sessizce siler;
    // webhook'ta bu id ile eşleşecek şekilde baştan tiresiz üretiyoruz.
    const checkoutSessionId = randomUUID().replace(/-/g, '');

    await prisma.tenantCheckoutSession.create({
      data: {
        id: checkoutSessionId,
        organizationId,
        gymMemberId,
        gatewayId: gateway.id,
        provider: gateway.provider,
        amount,
        currency,
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
        amount,
        currency,
        description: `${org.name} — Cari Hesap Ödemesi`,
        buyer,
        callbackUrl: `${siteConfig.url}/api/v1/webhooks/tenant-iyzico?session=${checkoutSessionId}`,
      });
      if (!result.ok) {
        return { error: result.error };
      }
      checkoutUrl = result.paymentPageUrl;
    } else if (gateway.provider === 'PAYTR') {
      const result = await initiatePaytrCheckout(
        toPaytrCredentials(gateway),
        {
          orderId: checkoutSessionId,
          amount,
          currency,
          description: `${org.name} — Cari Hesap Ödemesi`,
          buyer,
          callbackUrl: `${siteConfig.url}/api/v1/webhooks/tenant-paytr`,
        },
        `${siteConfig.url}/athlete/account?paytr=ok`,
        `${siteConfig.url}/athlete/account?paytr=fail`,
      );
      if (!result.ok) {
        return { error: result.error };
      }
      checkoutUrl = result.iframeUrl;
    } else {
      return { error: 'Desteklenmeyen ödeme sağlayıcısı.' };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ödeme başlatılamadı.' };
  }

  redirect(checkoutUrl);
}
