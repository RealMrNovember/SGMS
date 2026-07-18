import { createHmac } from 'crypto';
import Iyzipay from 'iyzipay';
import { prisma } from '@/lib/prisma';
import type { PlatformPaymentSettings } from '@sgms/database';

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettings> {
  return prisma.platformPaymentSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

function mask(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

/** İstemciye (Master Admin paneline) asla ham secret göndermeyiz — yalnızca son 4 hane. */
export function maskPlatformPaymentSettings(settings: PlatformPaymentSettings) {
  return {
    activeGateway: settings.activeGateway,
    iyzicoApiKeyMasked: mask(settings.iyzicoApiKey),
    iyzicoSecretKeyMasked: mask(settings.iyzicoSecretKey),
    iyzicoBaseUrl: settings.iyzicoBaseUrl,
    iyzicoSandbox: settings.iyzicoSandbox,
    iyzicoConfigured: Boolean(settings.iyzicoApiKey && settings.iyzicoSecretKey),
    paytrMerchantIdMasked: mask(settings.paytrMerchantId),
    paytrMerchantKeyMasked: mask(settings.paytrMerchantKey),
    paytrMerchantSaltMasked: mask(settings.paytrMerchantSalt),
    paytrSandbox: settings.paytrSandbox,
    paytrConfigured: Boolean(
      settings.paytrMerchantId && settings.paytrMerchantKey && settings.paytrMerchantSalt,
    ),
    bankTransferEnabled: settings.bankTransferEnabled,
    ibanHolderName: settings.ibanHolderName,
    ibanNumber: settings.ibanNumber,
    ibanBankName: settings.ibanBankName,
    bankTransferNote: settings.bankTransferNote,
    updatedAt: settings.updatedAt,
  };
}

/** Tenant tarafındaki fatura ekranı için — yalnızca banka bilgisi, hiçbir secret içermez. */
export async function getPublicBankTransferInfo() {
  const settings = await getPlatformPaymentSettings();
  if (!settings.bankTransferEnabled) {
    return null;
  }
  return {
    ibanHolderName: settings.ibanHolderName,
    ibanNumber: settings.ibanNumber,
    ibanBankName: settings.ibanBankName,
    bankTransferNote: settings.bankTransferNote,
  };
}

export type CheckoutBuyer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  ip: string;
};

export type InitiateCheckoutInput = {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  buyer: CheckoutBuyer;
  callbackUrl: string;
};

/**
 * iyzico Checkout Form Initialize — hosted ödeme sayfası. Resmi `iyzipay` SDK'sı
 * kullanılır. Gerçek anahtarlar girilmeden (sandbox/test anahtarı dahi) çağrılmamalı.
 */
export async function initiateIyzicoCheckout(
  settings: PlatformPaymentSettings,
  input: InitiateCheckoutInput,
): Promise<{ ok: true; paymentPageUrl: string } | { ok: false; error: string }> {
  if (!settings.iyzicoApiKey || !settings.iyzicoSecretKey) {
    return { ok: false, error: 'iyzico API anahtarları tanımlı değil.' };
  }

  const iyzipay = new Iyzipay({
    apiKey: settings.iyzicoApiKey,
    secretKey: settings.iyzicoSecretKey,
    uri: settings.iyzicoBaseUrl,
  });

  const [name, ...rest] = input.buyer.name.trim().split(' ');
  const surname = rest.join(' ') || name;

  const request = {
    locale: 'TR',
    conversationId: input.orderId,
    price: input.amount.toFixed(2),
    paidPrice: input.amount.toFixed(2),
    currency: input.currency === 'USD' ? Iyzipay.CURRENCY.USD : Iyzipay.CURRENCY.TRY,
    basketId: input.orderId,
    paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
    callbackUrl: input.callbackUrl,
    buyer: {
      id: input.buyer.id,
      name,
      surname,
      gsmNumber: input.buyer.phone || '+905000000000',
      email: input.buyer.email,
      identityNumber: '11111111111',
      registrationAddress: input.buyer.address || 'Belirtilmedi',
      ip: input.buyer.ip,
      city: input.buyer.city || 'Istanbul',
      country: input.buyer.country || 'Turkey',
    },
    shippingAddress: {
      contactName: input.buyer.name,
      city: input.buyer.city || 'Istanbul',
      country: input.buyer.country || 'Turkey',
      address: input.buyer.address || 'Belirtilmedi',
    },
    billingAddress: {
      contactName: input.buyer.name,
      city: input.buyer.city || 'Istanbul',
      country: input.buyer.country || 'Turkey',
      address: input.buyer.address || 'Belirtilmedi',
    },
    basketItems: [
      {
        id: input.orderId,
        name: input.description,
        category1: 'SaaS',
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: input.amount.toFixed(2),
      },
    ],
  };

  return new Promise((resolve) => {
    // @types/iyzipay yanlış şekilde checkoutFormInitialize.create'i 3DS ödeme (kart bilgisi
    // gerektiren) tipiyle işaretliyor — Checkout Form Initialize'da kart alanı yoktur, bu yüzden cast gerekiyor.
    iyzipay.checkoutFormInitialize.create(
      request as unknown as Parameters<typeof iyzipay.checkoutFormInitialize.create>[0],
      (err: Error | null, result: Iyzipay.CheckoutFormInitialResult) => {
        if (err) {
          resolve({ ok: false, error: 'iyzico bağlantı hatası.' });
          return;
        }
        const payload = result as unknown as { status: string; paymentPageUrl?: string; errorMessage?: string };
        if (payload.status !== 'success' || typeof payload.paymentPageUrl !== 'string') {
          resolve({ ok: false, error: payload.errorMessage || 'Ödeme sayfası oluşturulamadı.' });
          return;
        }
        resolve({ ok: true, paymentPageUrl: payload.paymentPageUrl });
      },
    );
  });
}

/**
 * PayTR "get-token" iFrame API. Resmi Node SDK'sı olmadığından belgelenen imza
 * şeması (HMAC-SHA256) burada elle uygulanır. Kaynak: PayTR entegrasyon kılavuzu.
 */
export async function initiatePaytrCheckout(
  settings: PlatformPaymentSettings,
  input: InitiateCheckoutInput,
  merchantOkUrl: string,
  merchantFailUrl: string,
): Promise<{ ok: true; iframeUrl: string } | { ok: false; error: string }> {
  if (!settings.paytrMerchantId || !settings.paytrMerchantKey || !settings.paytrMerchantSalt) {
    return { ok: false, error: 'PayTR mağaza bilgileri tanımlı değil.' };
  }

  const merchantOid = input.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
  const paymentAmountKurus = Math.round(input.amount * 100);
  const userBasket = Buffer.from(
    JSON.stringify([[input.description, input.amount.toFixed(2), 1]]),
  ).toString('base64');
  const noInstallment = 0;
  const maxInstallment = 0;
  const currency = input.currency === 'USD' ? 'USD' : 'TL';
  const testMode = settings.paytrSandbox ? 1 : 0;

  const hashStr =
    settings.paytrMerchantId +
    input.buyer.ip +
    merchantOid +
    input.buyer.email +
    paymentAmountKurus +
    userBasket +
    noInstallment +
    maxInstallment +
    currency +
    testMode;

  const paytrToken = createHmac('sha256', settings.paytrMerchantKey)
    .update(hashStr + settings.paytrMerchantSalt)
    .digest('base64');

  const body = new URLSearchParams({
    merchant_id: settings.paytrMerchantId,
    user_ip: input.buyer.ip,
    merchant_oid: merchantOid,
    email: input.buyer.email,
    payment_amount: String(paymentAmountKurus),
    payment_type: 'card',
    installment_count: String(noInstallment),
    currency,
    test_mode: String(testMode),
    non_3d: '0',
    merchant_ok_url: merchantOkUrl,
    merchant_fail_url: merchantFailUrl,
    user_name: input.buyer.name,
    user_address: input.buyer.address || 'Belirtilmedi',
    user_phone: input.buyer.phone || '05000000000',
    user_basket: userBasket,
    debug_on: '0',
    no_installment: String(noInstallment),
    max_installment: String(maxInstallment),
    paytr_token: paytrToken,
  });

  try {
    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const result = (await response.json()) as { status: string; token?: string; reason?: string };

    if (result.status !== 'success' || !result.token) {
      return { ok: false, error: result.reason || 'PayTR token alınamadı.' };
    }

    return { ok: true, iframeUrl: `https://www.paytr.com/odeme/guvenli/${result.token}` };
  } catch {
    return { ok: false, error: 'PayTR bağlantı hatası.' };
  }
}

export function verifyPaytrCallbackHash(
  settings: PlatformPaymentSettings,
  fields: { merchant_oid: string; status: string; total_amount: string; hash: string },
) {
  if (!settings.paytrMerchantKey || !settings.paytrMerchantSalt) return false;
  const hashStr =
    fields.merchant_oid + settings.paytrMerchantSalt + fields.status + fields.total_amount;
  const expected = createHmac('sha256', settings.paytrMerchantKey).update(hashStr).digest('base64');
  return expected === fields.hash;
}
