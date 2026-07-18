import { buildProformaInvoicePdf } from '@/lib/billing/proforma-invoice-pdf';
import { verifyProformaToken } from '@/lib/billing/proforma';
import { parseBillingSettings } from '@/lib/billing/settings';
import { getPublicBankTransferInfo } from '@/lib/payments/gateway';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = await verifyProformaToken(token);

  if (!check.valid) {
    return NextResponse.json({ ok: false, error: 'Bağlantının süresi dolmuş veya geçersiz.' }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: check.organizationId },
    select: { name: true, email: true, settings: true },
  });

  if (!org) {
    return NextResponse.json({ ok: false, error: 'Organizasyon bulunamadı.' }, { status: 404 });
  }

  const settings = parseBillingSettings(org.settings);
  const billingRequest = (settings.billingRequests ?? []).find((r) => r.id === check.billingRequestId);

  if (!billingRequest) {
    return NextResponse.json({ ok: false, error: 'Fatura kaydı bulunamadı.' }, { status: 404 });
  }

  const gatewaySession = await prisma.gatewayCheckoutSession.findUnique({
    where: { id: check.billingRequestId },
  });

  let paymentMethodLabel = 'Banka Havalesi / EFT';
  let bankTransfer: Awaited<ReturnType<typeof getPublicBankTransferInfo>> = null;

  if (gatewaySession) {
    paymentMethodLabel = gatewaySession.gateway === 'IYZICO' ? 'iyzico ile kart tahsilatı' : 'PayTR ile kart tahsilatı';
  } else {
    bankTransfer = await getPublicBankTransferInfo();
  }

  const { bytes, filename } = await buildProformaInvoicePdf({
    invoiceNo: billingRequest.id.slice(0, 8).toUpperCase(),
    issuedAt: billingRequest.resolvedAt ? new Date(billingRequest.resolvedAt) : new Date(billingRequest.createdAt),
    organizationName: org.name,
    organizationEmail: org.email,
    planName: billingRequest.planName,
    billingCycle: billingRequest.billingCycle,
    amount: billingRequest.amount,
    currency: billingRequest.currency,
    paymentMethodLabel,
    bankTransfer,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
