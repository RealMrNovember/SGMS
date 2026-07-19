'use server';

import { auth } from '@/lib/auth';
import { getMaskedTenantPaymentSettings } from '@/lib/payments/tenant-gateway';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function requireOrgAdmin() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error('Aktif salon oturumu gerekir.');
  }
  if (!session.user.role || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    throw new Error('Bu ayar için OWNER veya ADMIN yetkisi gerekir.');
  }
  if (session.user.isDemo) {
    throw new Error('Demo hesaplar değişiklik yapamaz. Bu bir inceleme hesabıdır — gerçek kullanım için ücretsiz deneme oluşturun.');
  }
  return session;
}

export async function fetchTenantPaymentSettings() {
  const session = await requireOrgAdmin();
  return getMaskedTenantPaymentSettings(session.user.organizationId!);
}

export type TenantPaymentGatewayState = {
  error?: string;
  success?: string;
};

const KEEP = '__keep__';

const schema = z.object({
  activeCardProvider: z.enum(['NONE', 'IYZICO', 'PAYTR']),
  iyzicoApiKey: z.string().optional(),
  iyzicoSecretKey: z.string().optional(),
  iyzicoBaseUrl: z.string().url(),
  iyzicoSandbox: z.enum(['on', 'off']).optional(),
  paytrMerchantId: z.string().optional(),
  paytrMerchantKey: z.string().optional(),
  paytrMerchantSalt: z.string().optional(),
  paytrSandbox: z.enum(['on', 'off']).optional(),
  bankTransferEnabled: z.enum(['on', 'off']).optional(),
  ibanHolderName: z.string().max(200).optional(),
  ibanNumber: z.string().max(50).optional(),
  ibanBankName: z.string().max(200).optional(),
  bankTransferNote: z.string().max(1000).optional(),
});

/**
 * Salonun kendi Iyzico/PayTR/Banka Havalesi ayarlarını kaydeder (Faz 8.7).
 * Kart sağlayıcılarından yalnızca biri aynı anda aktif olabilir (Master Admin'deki
 * `updatePlatformPaymentSettings` deseniyle birebir aynı UX) — banka havalesi bundan
 * bağımsız bir anahtar.
 */
export async function updateTenantPaymentSettings(
  _prev: TenantPaymentGatewayState,
  formData: FormData,
): Promise<TenantPaymentGatewayState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { error: 'Form bilgilerini kontrol edin: ' + parsed.error.issues[0]?.message };
  }

  try {
    const session = await requireOrgAdmin();
    const organizationId = session.user.organizationId!;
    const data = parsed.data;

    const existing = await prisma.tenantPaymentGateway.findMany({ where: { organizationId } });
    const byProvider = new Map(existing.map((row) => [row.provider, row]));

    await prisma.$transaction(async (tx) => {
      const iyzicoCurrent = byProvider.get('IYZICO');
      await tx.tenantPaymentGateway.upsert({
        where: { organizationId_provider: { organizationId, provider: 'IYZICO' } },
        create: {
          organizationId,
          provider: 'IYZICO',
          apiKey: data.iyzicoApiKey && data.iyzicoApiKey !== KEEP ? data.iyzicoApiKey : null,
          secretKey: data.iyzicoSecretKey && data.iyzicoSecretKey !== KEEP ? data.iyzicoSecretKey : null,
          baseUrl: data.iyzicoBaseUrl,
          sandbox: data.iyzicoSandbox === 'on',
          isActive: data.activeCardProvider === 'IYZICO',
          updatedById: session.user.id,
        },
        update: {
          apiKey:
            data.iyzicoApiKey && data.iyzicoApiKey !== KEEP ? data.iyzicoApiKey : iyzicoCurrent?.apiKey,
          secretKey:
            data.iyzicoSecretKey && data.iyzicoSecretKey !== KEEP
              ? data.iyzicoSecretKey
              : iyzicoCurrent?.secretKey,
          baseUrl: data.iyzicoBaseUrl,
          sandbox: data.iyzicoSandbox === 'on',
          isActive: data.activeCardProvider === 'IYZICO',
          updatedById: session.user.id,
        },
      });

      const paytrCurrent = byProvider.get('PAYTR');
      await tx.tenantPaymentGateway.upsert({
        where: { organizationId_provider: { organizationId, provider: 'PAYTR' } },
        create: {
          organizationId,
          provider: 'PAYTR',
          merchantId: data.paytrMerchantId && data.paytrMerchantId !== KEEP ? data.paytrMerchantId : null,
          merchantKey:
            data.paytrMerchantKey && data.paytrMerchantKey !== KEEP ? data.paytrMerchantKey : null,
          merchantSalt:
            data.paytrMerchantSalt && data.paytrMerchantSalt !== KEEP ? data.paytrMerchantSalt : null,
          sandbox: data.paytrSandbox === 'on',
          isActive: data.activeCardProvider === 'PAYTR',
          updatedById: session.user.id,
        },
        update: {
          merchantId:
            data.paytrMerchantId && data.paytrMerchantId !== KEEP
              ? data.paytrMerchantId
              : paytrCurrent?.merchantId,
          merchantKey:
            data.paytrMerchantKey && data.paytrMerchantKey !== KEEP
              ? data.paytrMerchantKey
              : paytrCurrent?.merchantKey,
          merchantSalt:
            data.paytrMerchantSalt && data.paytrMerchantSalt !== KEEP
              ? data.paytrMerchantSalt
              : paytrCurrent?.merchantSalt,
          sandbox: data.paytrSandbox === 'on',
          isActive: data.activeCardProvider === 'PAYTR',
          updatedById: session.user.id,
        },
      });

      await tx.tenantPaymentGateway.upsert({
        where: { organizationId_provider: { organizationId, provider: 'BANK_TRANSFER' } },
        create: {
          organizationId,
          provider: 'BANK_TRANSFER',
          ibanHolderName: data.ibanHolderName || null,
          ibanNumber: data.ibanNumber || null,
          ibanBankName: data.ibanBankName || null,
          bankTransferNote: data.bankTransferNote || null,
          isActive: data.bankTransferEnabled === 'on',
          updatedById: session.user.id,
        },
        update: {
          ibanHolderName: data.ibanHolderName || null,
          ibanNumber: data.ibanNumber || null,
          ibanBankName: data.ibanBankName || null,
          bankTransferNote: data.bankTransferNote || null,
          isActive: data.bankTransferEnabled === 'on',
          updatedById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'TENANT_PAYMENT_GATEWAY_CONFIGURED',
          entityType: 'tenant_payment_gateway',
          metadata: {
            activeCardProvider: data.activeCardProvider,
            bankTransferEnabled: data.bankTransferEnabled === 'on',
          },
        },
      });
    });

    revalidatePath('/dashboard/settings');
    return { success: 'Ödeme sağlayıcı ayarları kaydedildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.' };
  }
}
