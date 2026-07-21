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
import { createCategorySaleExpense } from '@/lib/store/category-sale';

export type StoreCheckoutItem = { categoryId: string; quantity: number };

export type StoreCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

const MAX_CART_LINES = 20;
const MAX_LINE_QUANTITY = 50;

/**
 * Sporcunun mobil mağazadan sepet ile self-servis kartla ödeme başlatması
 * (Faz 40). Faz 8.7.1'deki (`startMembershipRenewalCheckout`) checkout
 * altyapısı (Iyzico/PayTR hosted ödeme, `TenantCheckoutSession`, webhook
 * onayına kadar borç OPEN kalır) hiç kod tekrarı olmadan yeniden kullanılır.
 *
 * **Fark:** üyelik yenilemesi tek bir `Expense` hedefler; sepette birden
 * çok ürün olabileceğinden her sepet satırı için (Faz 17.6'daki
 * `quickAddCategoryExpense` ile birebir aynı stok düşümü/`Expense` oluşturma
 * mantığını kullanan) `createCategorySaleExpense` çağrılır ve tüm id'ler
 * `TenantCheckoutSession.storeExpenseIds`'e yazılır.
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
  for (const category of categories) {
    if (category.defaultAmount == null) {
      return { ok: false, error: `"${category.name}" için fiyat tanımlı değil. Lütfen resepsiyona başvurun.` };
    }
  }

  const gateway = await getActiveTenantCardGateway(organizationId);
  if (!gateway) {
    return { ok: false, error: 'Bu salon için kartla ödeme henüz aktif değil. Lütfen resepsiyona başvurun.' };
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  if (!org) {
    return { ok: false, error: 'Organizasyon bulunamadı.' };
  }

  let expenseIds: string[];
  let totalAmount: number;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        const category = categories.find((c) => c.id === item.categoryId);
        if (!category) {
          throw new Error('Sepetteki ürünlerden biri artık mağazada mevcut değil.');
        }
        results.push(
          await createCategorySaleExpense(tx, {
            organizationId,
            gymMemberId,
            category,
            createdById: member.userId!,
            quantity: item.quantity,
            channel: 'self_service',
          }),
        );
      }
      return results;
    });
    expenseIds = created.map((r) => r.id);
    totalAmount = Math.round(created.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sipariş oluşturulamadı.' };
  }

  const currency = 'TRY';
  const checkoutSessionId = randomUUID().replace(/-/g, '');
  const description = `Mağaza siparişi (${expenseIds.length} ürün)`;

  await prisma.tenantCheckoutSession.create({
    data: {
      id: checkoutSessionId,
      organizationId,
      gymMemberId,
      gatewayId: gateway.id,
      provider: gateway.provider,
      amount: totalAmount,
      currency,
      storeExpenseIds: expenseIds,
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
