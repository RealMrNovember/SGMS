'use server';

import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import { getPlatformPaymentSettings, maskPlatformPaymentSettings } from '@/lib/payments/gateway';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function fetchPlatformPaymentSettings() {
  await requireSuperAdmin();
  const settings = await getPlatformPaymentSettings();
  return maskPlatformPaymentSettings(settings);
}

export type PlatformPaymentSettingsState = {
  error?: string;
  success?: string;
};

const KEEP = '__keep__';

const schema = z.object({
  activeGateway: z.enum(['NONE', 'IYZICO', 'PAYTR']),
  iyzicoApiKey: z.string().optional(),
  iyzicoSecretKey: z.string().optional(),
  iyzicoBaseUrl: z.string().url(),
  iyzicoSandbox: z.enum(['on', 'off']),
  paytrMerchantId: z.string().optional(),
  paytrMerchantKey: z.string().optional(),
  paytrMerchantSalt: z.string().optional(),
  paytrSandbox: z.enum(['on', 'off']),
  bankTransferEnabled: z.enum(['on', 'off']),
  ibanHolderName: z.string().max(200).optional(),
  ibanNumber: z.string().max(50).optional(),
  ibanBankName: z.string().max(200).optional(),
  bankTransferNote: z.string().max(1000).optional(),
});

export async function updatePlatformPaymentSettings(
  _prev: PlatformPaymentSettingsState,
  formData: FormData,
): Promise<PlatformPaymentSettingsState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { error: 'Form bilgilerini kontrol edin: ' + parsed.error.issues[0]?.message };
  }

  try {
    const session = await requireSuperAdmin();
    const data = parsed.data;

    // Boş bırakılan / KEEP işaretli secret alanları mevcut değeri korur — panelde
    // maskelenmiş gösterildiği için formdan geri "••••" gönderilmez, boş gelir.
    const current = await getPlatformPaymentSettings();

    await prisma.platformPaymentSettings.update({
      where: { id: 'singleton' },
      data: {
        activeGateway: data.activeGateway,
        iyzicoApiKey: data.iyzicoApiKey && data.iyzicoApiKey !== KEEP ? data.iyzicoApiKey : current.iyzicoApiKey,
        iyzicoSecretKey:
          data.iyzicoSecretKey && data.iyzicoSecretKey !== KEEP ? data.iyzicoSecretKey : current.iyzicoSecretKey,
        iyzicoBaseUrl: data.iyzicoBaseUrl,
        iyzicoSandbox: data.iyzicoSandbox === 'on',
        paytrMerchantId:
          data.paytrMerchantId && data.paytrMerchantId !== KEEP ? data.paytrMerchantId : current.paytrMerchantId,
        paytrMerchantKey:
          data.paytrMerchantKey && data.paytrMerchantKey !== KEEP ? data.paytrMerchantKey : current.paytrMerchantKey,
        paytrMerchantSalt:
          data.paytrMerchantSalt && data.paytrMerchantSalt !== KEEP
            ? data.paytrMerchantSalt
            : current.paytrMerchantSalt,
        paytrSandbox: data.paytrSandbox === 'on',
        bankTransferEnabled: data.bankTransferEnabled === 'on',
        ibanHolderName: data.ibanHolderName || null,
        ibanNumber: data.ibanNumber || null,
        ibanBankName: data.ibanBankName || null,
        bankTransferNote: data.bankTransferNote || null,
        updatedById: session.user.id,
      },
    });

    await writeAdminAuditLog({
      actorId: session.user.id!,
      organizationId: null,
      action: 'PLATFORM_PAYMENT_SETTINGS_CHANGED',
      entityType: 'platform_payment_settings',
      metadata: {
        activeGateway: data.activeGateway,
        bankTransferEnabled: data.bankTransferEnabled === 'on',
      },
    });

    revalidatePath('/admin/payments');
    return { success: 'Ödeme ayarları kaydedildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.' };
  }
}
