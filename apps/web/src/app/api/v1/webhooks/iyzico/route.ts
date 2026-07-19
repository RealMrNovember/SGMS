import Iyzipay from 'iyzipay';
import { activateSubscriptionFromRequest } from '@/lib/billing/activate';
import { getPlatformPaymentSettings } from '@/lib/payments/gateway';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * iyzico Checkout Form callback — ödeme tamamlandığında iyzico bu adrese
 * `token` alanını içeren form-urlencoded bir POST gönderir. Gerçek sonucu
 * öğrenmek için token, iyzico'nun retrieve endpoint'ine geri sorulur.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get('token');

  if (typeof token !== 'string' || !token) {
    return NextResponse.redirect(new URL('/dashboard/billing?payment=error', request.nextUrl.origin));
  }

  const settings = await getPlatformPaymentSettings();
  if (!settings.iyzicoApiKey || !settings.iyzicoSecretKey) {
    return NextResponse.redirect(new URL('/dashboard/billing?payment=error', request.nextUrl.origin));
  }

  const iyzipay = new Iyzipay({
    apiKey: settings.iyzicoApiKey,
    secretKey: settings.iyzicoSecretKey,
    uri: settings.iyzicoBaseUrl,
  });

  const result = await new Promise<Record<string, unknown>>((resolve) => {
    iyzipay.checkoutForm.retrieve(
      { locale: 'TR', token },
      (err: Error | null, res: Iyzipay.CheckoutFormRetrieveResult) => {
        resolve(err ? {} : (res as unknown as Record<string, unknown>));
      },
    );
  });

  const orderId = (result.basketId as string) || (result.conversationId as string);
  const paymentSuccessful = result.status === 'success' && result.paymentStatus === 'SUCCESS';

  if (orderId) {
    // Atomik "claim" — aynı webhook iki kez tetiklenirse (iyzico retry) yalnızca ilk
    // çağrı `count: 1` alır ve devam eder; ikincisi hiçbir şeye dokunmadan çıkar.
    // Bkz. roadmap.md Faz 36.7.
    const claim = await prisma.gatewayCheckoutSession.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'processing' },
    });

    if (claim.count > 0) {
      const session = await prisma.gatewayCheckoutSession.findUnique({ where: { id: orderId } });
      if (session) {
        if (paymentSuccessful) {
          const activation = await activateSubscriptionFromRequest(
            session.organizationId,
            session.billingRequestId,
            'gateway:iyzico',
            null,
          );
          await prisma.gatewayCheckoutSession.update({
            where: { id: orderId },
            data: { status: activation.ok ? 'completed' : 'failed' },
          });
        } else {
          await prisma.gatewayCheckoutSession.update({ where: { id: orderId }, data: { status: 'failed' } });
        }
      }
    }
  }

  return NextResponse.redirect(
    new URL(`/dashboard/billing?payment=${paymentSuccessful ? 'success' : 'failed'}`, request.nextUrl.origin),
  );
}
