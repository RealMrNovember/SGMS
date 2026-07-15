'use server';

import { requirePartnerOwnsOrganization } from '@/lib/partner/guards';
import { syncOrganizationToCloud } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type PartnerActionState = {
  error?: string;
  success?: string;
};

/**
 * Temsilcinin kendi başına verebileceği en geniş yetkiler — Master Admin'in
 * (`admin-organizations.ts`) yetkilerinden kasıtlı olarak daha dar tutulur.
 * Daha büyük bir talep gelirse (ör. %30 üstü indirim), temsilci Master Admin'e
 * yönlendirilmelidir — bu sınırlar iş kuralı, teknik kısıt değildir.
 */
const PARTNER_LIMITS = {
  maxTrialExtensionDays: 30,
  maxDiscountPercent: 30,
  maxExtraMembers: 100,
  maxExtraStaff: 10,
  maxExtraDevices: 5,
} as const;

function revalidatePartnerViews(organizationId: string) {
  revalidatePath('/partner');
  revalidatePath(`/partner/organizations/${organizationId}`);
}

const extendTrialSchema = z.object({
  organizationId: z.string().cuid(),
  days: z.coerce.number().int().min(1).max(PARTNER_LIMITS.maxTrialExtensionDays),
});

/** Senaryo: Enes'in getirdiği salon sahibi ödemeyi birkaç gün geciktirdi — Enes,
 * ilişkiyi kaybetmemek için müşterisinin süresini kendi yetkisiyle uzatabilir. */
export async function partnerExtendTrial(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = extendTrialSchema.safeParse({
    organizationId: formData.get('organizationId'),
    days: formData.get('days'),
  });

  if (!parsed.success) {
    return { error: `Geçerli bir gün sayısı girin (1–${PARTNER_LIMITS.maxTrialExtensionDays}).` };
  }

  try {
    const { organizationId, days } = parsed.data;
    const { partnerId } = await requirePartnerOwnsOrganization(organizationId);

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Abonelik kaydı bulunamadı.' };
    }

    const base = subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? new Date();
    const startFrom = base.getTime() > Date.now() ? base : new Date();
    const newEnd = new Date(startFrom.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data:
          subscription.status === 'ACTIVE'
            ? { currentPeriodEnd: newEnd }
            : { status: 'TRIALING', trialEndsAt: newEnd, currentPeriodEnd: newEnd, canceledAt: null },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: { licenseExpiresAt: newEnd },
      });

      await tx.auditLog.create({
        data: {
          actorId: partnerId,
          organizationId,
          action: 'PARTNER_TRIAL_EXTENDED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: { extendedDays: days, newEnd: newEnd.toISOString(), source: 'partner' },
        },
      });
    });

    await syncOrganizationToCloud(organizationId);
    revalidatePartnerViews(organizationId);
    return { success: `Süre ${days} gün uzatıldı — yeni bitiş: ${newEnd.toLocaleDateString('tr-TR')}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Süre uzatılamadı.' };
  }
}

const discountSchema = z.object({
  organizationId: z.string().cuid(),
  discountPercent: z.coerce.number().int().min(0).max(PARTNER_LIMITS.maxDiscountPercent),
  note: z.string().max(200).optional().or(z.literal('')),
});

/** Senaryo: Enes, getirdiği müşteriye özel "bana güvenerek geldin" indirimi tanımlar —
 * bu indirim yalnızca bu organizasyona uygulanır, genel bir kupon kodu değildir. */
export async function partnerSetDiscount(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = discountSchema.safeParse({
    organizationId: formData.get('organizationId'),
    discountPercent: formData.get('discountPercent'),
    note: formData.get('note') ?? '',
  });

  if (!parsed.success) {
    return { error: `İndirim oranı 0–${PARTNER_LIMITS.maxDiscountPercent} arasında olmalı.` };
  }

  try {
    const { organizationId, discountPercent, note } = parsed.data;
    const { partnerId } = await requirePartnerOwnsOrganization(organizationId);

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Abonelik kaydı bulunamadı.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          partnerDiscountPercent: discountPercent,
          partnerDiscountNote: note || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: partnerId,
          organizationId,
          action: 'PARTNER_DISCOUNT_UPDATED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: { discountPercent, note: note || null, source: 'partner' },
        },
      });
    });

    revalidatePartnerViews(organizationId);
    return { success: `Bu müşteri için indirim %${discountPercent} olarak ayarlandı.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'İndirim ayarlanamadı.' };
  }
}

const capacitySchema = z.object({
  organizationId: z.string().cuid(),
  extraMembers: z.coerce.number().int().min(0).max(PARTNER_LIMITS.maxExtraMembers),
  extraStaff: z.coerce.number().int().min(0).max(PARTNER_LIMITS.maxExtraStaff),
  extraDevices: z.coerce.number().int().min(0).max(PARTNER_LIMITS.maxExtraDevices),
});

/** Senaryo: Müşteri büyüyor, plan limitine yaklaştı ama henüz üst pakete geçmeye
 * hazır değil — Enes, kendi yetkisi dahilinde ek üye/personel/cihaz kapasitesi tanımlar. */
export async function partnerAdjustCapacity(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = capacitySchema.safeParse({
    organizationId: formData.get('organizationId'),
    extraMembers: formData.get('extraMembers'),
    extraStaff: formData.get('extraStaff'),
    extraDevices: formData.get('extraDevices'),
  });

  if (!parsed.success) {
    return {
      error: `Ek kapasite sınırları içinde kalmalı (üye ≤ ${PARTNER_LIMITS.maxExtraMembers}, personel ≤ ${PARTNER_LIMITS.maxExtraStaff}, cihaz ≤ ${PARTNER_LIMITS.maxExtraDevices}).`,
    };
  }

  try {
    const { organizationId, extraMembers, extraStaff, extraDevices } = parsed.data;
    const { partnerId } = await requirePartnerOwnsOrganization(organizationId);

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          extraMemberCapacity: extraMembers,
          extraStaffCapacity: extraStaff,
          extraDeviceCapacity: extraDevices,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: partnerId,
          organizationId,
          action: 'PARTNER_CAPACITY_ADJUSTED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { extraMembers, extraStaff, extraDevices, source: 'partner' },
        },
      });
    });

    revalidatePartnerViews(organizationId);
    return { success: 'Ek kapasite güncellendi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kapasite güncellenemedi.' };
  }
}

export { PARTNER_LIMITS };
