import { prisma } from '@/lib/prisma';
import type { PaymentProviderType, TenantPaymentGateway } from '@sgms/database';
import type { IyzicoCredentials, PaytrCredentials } from '@/lib/payments/gateway';

const CARD_PROVIDERS: readonly PaymentProviderType[] = ['IYZICO', 'PAYTR'];

function mask(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

export async function getTenantPaymentGateways(organizationId: string): Promise<TenantPaymentGateway[]> {
  return prisma.tenantPaymentGateway.findMany({ where: { organizationId } });
}

/** İstemciye asla ham secret göndermeyiz — yalnızca son 4 hane (Faz 16.3 desenini izler). */
export function maskTenantPaymentGateway(gateway: TenantPaymentGateway | undefined) {
  if (!gateway) return null;
  return {
    provider: gateway.provider,
    isActive: gateway.isActive,
    apiKeyMasked: mask(gateway.apiKey),
    secretKeyMasked: mask(gateway.secretKey),
    merchantIdMasked: mask(gateway.merchantId),
    merchantKeyMasked: mask(gateway.merchantKey),
    merchantSaltMasked: mask(gateway.merchantSalt),
    baseUrl: gateway.baseUrl,
    sandbox: gateway.sandbox,
    ibanHolderName: gateway.ibanHolderName,
    ibanNumber: gateway.ibanNumber,
    ibanBankName: gateway.ibanBankName,
    bankTransferNote: gateway.bankTransferNote,
    configured:
      gateway.provider === 'BANK_TRANSFER'
        ? Boolean(gateway.ibanNumber)
        : gateway.provider === 'IYZICO'
          ? Boolean(gateway.apiKey && gateway.secretKey)
          : Boolean(gateway.merchantId && gateway.merchantKey && gateway.merchantSalt),
  };
}

export async function getMaskedTenantPaymentSettings(organizationId: string) {
  const rows = await getTenantPaymentGateways(organizationId);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return {
    iyzico: maskTenantPaymentGateway(byProvider.get('IYZICO')),
    paytr: maskTenantPaymentGateway(byProvider.get('PAYTR')),
    bankTransfer: maskTenantPaymentGateway(byProvider.get('BANK_TRANSFER')),
  };
}

/**
 * Sporcu portalında "Kartla Öde" butonunu göstermek için — org'un aktif VE
 * anahtarları eksiksiz girilmiş kart sağlayıcısı (varsa). Aktif ama yapılandırması
 * eksik bir sağlayıcı burada `null` döner — her zaman başarısız olacak bir buton
 * göstermek yerine, salon sahibi ayarları tamamlayana kadar hiç gösterilmez.
 */
export async function getActiveTenantCardGateway(
  organizationId: string,
): Promise<TenantPaymentGateway | null> {
  const gateway = await prisma.tenantPaymentGateway.findFirst({
    where: { organizationId, provider: { in: [...CARD_PROVIDERS] }, isActive: true },
  });
  if (!gateway) return null;

  const configured =
    gateway.provider === 'IYZICO'
      ? Boolean(gateway.apiKey && gateway.secretKey)
      : Boolean(gateway.merchantId && gateway.merchantKey && gateway.merchantSalt);

  return configured ? gateway : null;
}

export async function getTenantBankTransferInfo(organizationId: string) {
  const row = await prisma.tenantPaymentGateway.findUnique({
    where: { organizationId_provider: { organizationId, provider: 'BANK_TRANSFER' } },
  });
  if (!row || !row.isActive || !row.ibanNumber) {
    return null;
  }
  return {
    ibanHolderName: row.ibanHolderName,
    ibanNumber: row.ibanNumber,
    ibanBankName: row.ibanBankName,
    bankTransferNote: row.bankTransferNote,
  };
}

/** `TenantPaymentGateway` (IYZICO satırı) → Faz 16.3'teki `initiateIyzicoCheckout` fonksiyonunun beklediği şekil. */
export function toIyzicoCredentials(gateway: TenantPaymentGateway): IyzicoCredentials {
  return {
    iyzicoApiKey: gateway.apiKey,
    iyzicoSecretKey: gateway.secretKey,
    iyzicoBaseUrl: gateway.baseUrl,
  };
}

/** `TenantPaymentGateway` (PAYTR satırı) → `initiatePaytrCheckout`/`verifyPaytrCallbackHash` şekli. */
export function toPaytrCredentials(gateway: TenantPaymentGateway): PaytrCredentials {
  return {
    paytrMerchantId: gateway.merchantId,
    paytrMerchantKey: gateway.merchantKey,
    paytrMerchantSalt: gateway.merchantSalt,
    paytrSandbox: gateway.sandbox,
  };
}
