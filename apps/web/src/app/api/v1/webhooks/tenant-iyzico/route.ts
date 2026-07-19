import Iyzipay from 'iyzipay';
import { toIyzicoCredentials } from '@/lib/payments/tenant-gateway';
import { settleTenantCheckoutSession } from '@/lib/payments/tenant-checkout-settle';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Faz 8.7 — salon bazlı iyzico Checkout Form callback'i. Platformun kendi
 * `/api/v1/webhooks/iyzico` rotasıyla aynı desen, farkı: hangi organizasyonun
 * kimlik bilgileriyle `retrieve` çağrılacağı `session` query param'ından (bkz.
 * `startTenantCardCheckout`'taki callbackUrl) bulunuyor — her salonun kendi
 * Iyzico hesabı olduğundan platformun tek/paylaşımlı anahtarı burada geçerli değil.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');
  const checkoutSessionId = request.nextUrl.searchParams.get('session');

  if (typeof token !== 'string' || !token || !checkoutSessionId) {
    return NextResponse.redirect(new URL('/athlete/account?payment=error', request.nextUrl.origin));
  }

  const checkoutSession = await prisma.tenantCheckoutSession.findUnique({
    where: { id: checkoutSessionId },
    include: { gateway: true },
  });

  if (!checkoutSession) {
    return NextResponse.redirect(new URL('/athlete/account?payment=error', request.nextUrl.origin));
  }

  const credentials = toIyzicoCredentials(checkoutSession.gateway);
  if (!credentials.iyzicoApiKey || !credentials.iyzicoSecretKey) {
    return NextResponse.redirect(new URL('/athlete/account?payment=error', request.nextUrl.origin));
  }

  const iyzipay = new Iyzipay({
    apiKey: credentials.iyzicoApiKey,
    secretKey: credentials.iyzicoSecretKey,
    uri: credentials.iyzicoBaseUrl,
  });

  const result = await new Promise<Record<string, unknown>>((resolve) => {
    iyzipay.checkoutForm.retrieve(
      { locale: 'TR', token },
      (err: Error | null, res: Iyzipay.CheckoutFormRetrieveResult) => {
        resolve(err ? {} : (res as unknown as Record<string, unknown>));
      },
    );
  });

  const returnedOrderId = (result.basketId as string) || (result.conversationId as string);
  const paymentSuccessful =
    result.status === 'success' &&
    result.paymentStatus === 'SUCCESS' &&
    returnedOrderId === checkoutSessionId;

  await settleTenantCheckoutSession(checkoutSessionId, paymentSuccessful);

  return NextResponse.redirect(
    new URL(`/athlete/account?payment=${paymentSuccessful ? 'success' : 'failed'}`, request.nextUrl.origin),
  );
}
