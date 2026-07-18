import { activateSubscriptionFromRequest } from '@/lib/billing/activate';
import { getPlatformPaymentSettings, verifyPaytrCallbackHash } from '@/lib/payments/gateway';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PayTR bildirim (notification) webhook'u — ödeme sonucu asenkron olarak buraya
 * POST edilir. PayTR, gövdede düz metin "OK" dönmedikçe tekrar tekrar dener.
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

  const settings = await getPlatformPaymentSettings();
  const validHash = verifyPaytrCallbackHash(settings, {
    merchant_oid: merchantOid,
    status,
    total_amount: totalAmount,
    hash,
  });

  if (!validHash) {
    return new NextResponse('OK');
  }

  const session = await prisma.gatewayCheckoutSession.findUnique({ where: { id: merchantOid } });

  if (session && session.status === 'pending') {
    if (status === 'success') {
      const activation = await activateSubscriptionFromRequest(
        session.organizationId,
        session.billingRequestId,
        'gateway:paytr',
        null,
      );
      await prisma.gatewayCheckoutSession.update({
        where: { id: merchantOid },
        data: { status: activation.ok ? 'completed' : 'failed' },
      });
    } else {
      await prisma.gatewayCheckoutSession.update({ where: { id: merchantOid }, data: { status: 'failed' } });
    }
  }

  return new NextResponse('OK');
}
