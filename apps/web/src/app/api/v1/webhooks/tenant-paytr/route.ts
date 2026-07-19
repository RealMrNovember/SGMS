import { verifyPaytrCallbackHash } from '@/lib/payments/gateway';
import { toPaytrCredentials } from '@/lib/payments/tenant-gateway';
import { settleTenantCheckoutSession } from '@/lib/payments/tenant-checkout-settle';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Faz 8.7 — salon bazlı PayTR bildirim webhook'u. `merchant_oid` doğrudan
 * `TenantCheckoutSession.id`'dir (bkz. `startTenantCardCheckout` — id kasıtlı
 * olarak tiresiz üretilir, PayTR merchant_oid'de yalnızca alfanümerik kabul eder).
 * Bu id üzerinden önce oturum/organizasyon bulunur, ardından O organizasyonun
 * kendi `merchantKey`/`merchantSalt`'ıyla hash doğrulanır.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const merchantOid = String(form.get('merchant_oid') ?? '');
  const status = String(form.get('status') ?? '');
  const totalAmount = String(form.get('total_amount') ?? '');
  const hash = String(form.get('hash') ?? '');

  if (!merchantOid || !hash) {
    return new NextResponse('OK');
  }

  const checkoutSession = await prisma.tenantCheckoutSession.findUnique({
    where: { id: merchantOid },
    include: { gateway: true },
  });

  if (!checkoutSession) {
    return new NextResponse('OK');
  }

  const validHash = verifyPaytrCallbackHash(toPaytrCredentials(checkoutSession.gateway), {
    merchant_oid: merchantOid,
    status,
    total_amount: totalAmount,
    hash,
  });

  if (!validHash) {
    return new NextResponse('OK');
  }

  await settleTenantCheckoutSession(merchantOid, status === 'success');

  return new NextResponse('OK');
}
