import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiError, apiOk } from '@/lib/api/response';
import { startStoreCheckout, type StoreCheckoutItem } from '@/lib/store/checkout';

/**
 * Mobil "Mağaza" sepeti — kartla ödeme başlatır (Faz 40). Web'deki
 * `startMembershipRenewalCheckout`/`/api/v1/me/membership/renew` deseniyle
 * birebir aynı şekilde: sonuç doğrudan JSON `checkoutUrl` olarak döner, mobil
 * bunu sistem tarayıcısında açar.
 */
export async function POST(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz istek gövdesi.', 400);
  }

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return apiError('Sepetiniz boş.', 400);
  }

  const parsedItems: StoreCheckoutItem[] = [];
  for (const raw of items) {
    const categoryId = (raw as { categoryId?: unknown })?.categoryId;
    const quantity = (raw as { quantity?: unknown })?.quantity;
    if (typeof categoryId !== 'string' || !categoryId || typeof quantity !== 'number') {
      return apiError('Geçersiz sepet satırı.', 400);
    }
    parsedItems.push({ categoryId, quantity: Math.trunc(quantity) });
  }

  try {
    const result = await startStoreCheckout({ organizationId, gymMemberId, items: parsedItems });
    if (!result.ok) {
      return apiError(result.error, 400);
    }
    return apiOk({ checkoutUrl: result.checkoutUrl });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Sipariş başlatılamadı.', 500);
  }
}
