import { randomUUID } from 'crypto';
import { getRequestAuditContext } from '@/lib/audit/logger';
import { initiateIyzicoCheckout, initiatePaytrCheckout } from '@/lib/payments/gateway';
import {
  getActiveTenantCardGateway,
  toIyzicoCredentials,
  toPaytrCredentials,
} from '@/lib/payments/tenant-gateway';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

export type StoreCheckoutItem = { categoryId: string; quantity: number };

export type StoreCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

const MAX_CART_LINES = 20;
const MAX_LINE_QUANTITY = 50;

/**
 * Sporcunun mobil mağazadan sepet ile self-servis kartla ödeme başlatması
 * (Faz 40). Stok düşümü ve OPEN borç, ödeme webhook onayına kadar
 * ertelenir (`storeCartJson`); terk edilen sepet hayalet borç/stok kaybı
 * yaratmaz.
 */
export async function startStoreCheckout(params: {
  organizationId: string;
  gymMemberId: string;
  items: StoreCheckoutItem[];
}): Promise<StoreCheckoutResult> {
  const { organizationId, gymMemberId, items } = params;

  if (items.length === 0) {
    return { ok: false, error: 'Sepetiniz boş.' };
  }
  if (items.length > MAX_CART_LINES) {
    return { ok: false, error: 'Sepette çok fazla ürün var.' };
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) {
      return { ok: false, error: 'Geçersiz ürün adedi.' };
    }
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!member) {
    return { ok: false, error: 'Üye bulunamadı.' };
  }
  if (!member.userId) {
    return { ok: false, error: 'Hesabınız mağaza siparişi için uygun değil. Lütfen resepsiyona başvurun.' };
  }

  const categoryIds = [...new Set(items.map((item) => item.categoryId))];
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds }, organizationId, isActive: true, isStoreVisible: true },
  });

  if (categories.length !== categoryIds.length) {
    return { ok: false, error: 'Sepetteki ürünlerden biri artık mağazada mevcut değil.' };
  }

  let totalAmount = 0;
  for (const item of items) {
    const category = categories.find((c) => c.id === item.categoryId);
    if (!category || category.defaultAmount == null) {
      return {
        ok: false,
        error: `"${category?.name ?? 'Ürün'}" için fiyat tanımlı değil. Lütfen resepsiyona başvurun.`,
      };
    }
    if (category.stockQuantity != null && category.stockQuantity < item.quantity) {
      return { ok: false, error: `"${category.name}" stokta yok.` };
    }
    totalAmount += Number(category.defaultAmount) * item.quantity;
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  const gateway = await getActiveTenantCardGateway(organizationId);
  if (!gateway) {
    return { ok: false, error: 'Bu salon için kartla ödeme henüz aktif değil. Lütfen resepsiyona başvurun.' };
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  if (!org) {
    return { ok: false, error: 'Organizasyon bulunamadı.' };
  }

  const currency = 'TRY';
  const checkoutSessionId = randomUUID().replace(/-/g, '');
  const description = `Mağaza siparişi (${items.length} ürün)`;
  const cartJson = items.map((item) => ({ categoryId: item.categoryId, quantity: item.quantity }));

  await prisma.tenantCheckoutSession.create({
    data: {
      id: checkoutSessionId,
      organizationId,
      gymMemberId,
      gatewayId: gateway.id,
      provider: gateway.provider,
      amount: totalAmount,
      currency,
      storeCartJson: cartJson,
      storeExpenseIds: [],
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
      amount: totalAmount,
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
        amount: totalAmount,
        currency,
        description: `${org.name} — ${description}`,
        buyer,
        callbackUrl: `${siteConfig.url}/api/v1/webhooks/tenant-paytr`,
      },
      `${siteConfig.url}/athlete/account?store=ok`,
      `${siteConfig.url}/athlete/account?store=fail`,
    );
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, checkoutUrl: result.iframeUrl };
  }

  return { ok: false, error: 'Desteklenmeyen ödeme sağlayıcısı.' };
}
