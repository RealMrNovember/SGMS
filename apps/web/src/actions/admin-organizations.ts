'use server';

import { auth } from '@/lib/auth';
import {
  bootstrapOrganizationLicense,
  resolveOrganizationLicenseMetadata,
} from '@/lib/license';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import { appendSupportNote, parseOrganizationSettings } from '@/lib/admin/org-settings';
import { prisma } from '@/lib/prisma';
import type { OrganizationStatus, Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AdminActionState = {
  error?: string;
  success?: string;
};

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Bu işlem için Master Admin yetkisi gerekir.');
  }
  return session;
}

function revalidateOrg(orgId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath('/admin/audit');
}

export async function updateOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus,
): Promise<AdminActionState> {
  try {
    const session = await requireSuperAdmin();

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'ORGANIZATION_UPDATED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { status, updatedBy: 'master_admin' },
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: `Organizasyon durumu ${status} olarak güncellendi.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Durum güncellenemedi.',
    };
  }
}

const extendTrialSchema = z.object({
  organizationId: z.string().cuid(),
  days: z.coerce.number().int().min(1).max(90),
});

export async function extendOrganizationTrial(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = extendTrialSchema.safeParse({
    organizationId: formData.get('organizationId'),
    days: formData.get('days'),
  });

  if (!parsed.success) {
    return { error: 'Geçerli bir gün sayısı girin (1–90).' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, days } = parsed.data;

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId, status: 'TRIALING' },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Aktif deneme aboneliği bulunamadı.' };
    }

    const base = subscription.trialEndsAt ?? subscription.currentPeriodEnd ?? new Date();
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          licenseExpiresAt: trialEndsAt,
          centralLicenseStatus: 'TRIAL',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'SUBSCRIPTION_CHANGED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: { extendedDays: days, trialEndsAt: trialEndsAt.toISOString() },
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: `Deneme süresi ${days} gün uzatıldı.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Deneme uzatılamadı.',
    };
  }
}

const activateSchema = z.object({
  organizationId: z.string().cuid(),
});

export async function activateOrganizationSubscription(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = activateSchema.safeParse({
    organizationId: formData.get('organizationId'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz organizasyon.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId } = parsed.data;

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Abonelik kaydı bulunamadı.' };
    }

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          status: 'ACTIVE',
          centralLicenseStatus: 'ACTIVE',
          licenseExpiresAt: periodEnd,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'SUBSCRIPTION_STARTED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: { activatedBy: 'master_admin', periodEnd: periodEnd.toISOString() },
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: 'Abonelik ücretli paket olarak aktifleştirildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Abonelik aktifleştirilemedi.',
    };
  }
}

const changePlanSchema = z.object({
  organizationId: z.string().cuid(),
  planId: z.string().cuid(),
});

export async function changeOrganizationPlan(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = changePlanSchema.safeParse({
    organizationId: formData.get('organizationId'),
    planId: formData.get('planId'),
  });

  if (!parsed.success) {
    return { error: 'Geçerli bir plan seçin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, planId } = parsed.data;

    const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) {
      return { error: 'Plan bulunamadı.' };
    }

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
        data: { planId: plan.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'SUBSCRIPTION_CHANGED',
          entityType: 'subscription',
          entityId: subscription.id,
          metadata: { planCode: plan.code, planName: plan.name },
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: `Plan ${plan.name} olarak güncellendi.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Plan değiştirilemedi.',
    };
  }
}

export async function syncOrganizationLicenseAdmin(
  organizationId: string,
): Promise<AdminActionState> {
  try {
    const session = await requireSuperAdmin();

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { installationId: true },
    });

    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    const metadata = await resolveOrganizationLicenseMetadata(organizationId);
    const result = await bootstrapOrganizationLicense(organizationId, org.installationId, {
      metadata,
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        organizationId,
        action: 'LICENSE_HEARTBEAT',
        entityType: 'organization',
        entityId: organizationId,
        metadata: { source: 'master_admin_sync', ok: result.ok, status: result.status },
      },
    });

    revalidateOrg(organizationId);

    if (!result.ok) {
      return { error: result.message ?? 'Lisans senkronu başarısız.' };
    }

    return { success: `Lisans senkronu tamamlandı (${result.status}).` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Lisans senkronu başarısız.',
    };
  }
}

const noteSchema = z.object({
  organizationId: z.string().cuid(),
  text: z.string().min(3).max(2000),
});

export async function addOrganizationSupportNote(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = noteSchema.safeParse({
    organizationId: formData.get('organizationId'),
    text: formData.get('text'),
  });

  if (!parsed.success) {
    return { error: 'Not en az 3 karakter olmalı.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, text } = parsed.data;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    const settings = parseOrganizationSettings(org.settings);
    const nextSettings = appendSupportNote(settings, {
      text: text.trim(),
      createdBy: session.user.name ?? 'Master Admin',
      createdByEmail: session.user.email ?? undefined,
    });

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: 'SETTINGS_CHANGED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { supportNoteAdded: true },
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: 'Destek notu kaydedildi.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Not kaydedilemedi.',
    };
  }
}

export async function suspendOrganization(organizationId: string): Promise<AdminActionState> {
  return updateOrganizationStatus(organizationId, 'SUSPENDED');
}

export async function activateOrganization(organizationId: string): Promise<AdminActionState> {
  return updateOrganizationStatus(organizationId, 'ACTIVE');
}

export async function archiveOrganization(organizationId: string): Promise<AdminActionState> {
  return updateOrganizationStatus(organizationId, 'ARCHIVED');
}

const profileSchema = z.object({
  organizationId: z.string().cuid(),
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(32).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  country: z.string().length(2),
  timezone: z.string().min(3).max(64),
});

export async function updateOrganizationProfile(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = profileSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    address: formData.get('address') ?? '',
    city: formData.get('city') ?? '',
    country: formData.get('country'),
    timezone: formData.get('timezone'),
  });

  if (!parsed.success) {
    return { error: 'Salon bilgilerini kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const data = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: data.organizationId } });
    if (!org) {
      return { error: 'Organizasyon bulunamadı.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: data.organizationId },
        data: {
          name: data.name.trim(),
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          country: data.country,
          timezone: data.timezone,
        },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId: data.organizationId,
        action: 'ORGANIZATION_UPDATED',
        entityType: 'organization',
        entityId: data.organizationId,
        metadata: {
          fields: ['name', 'email', 'phone', 'address', 'city', 'country', 'timezone'],
          previousName: org.name,
        },
      });
    });

    revalidateOrg(data.organizationId);
    return { success: 'Salon profili güncellendi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Profil güncellenemedi.' };
  }
}

const periodSchema = z.object({
  organizationId: z.string().cuid(),
  planId: z.string().cuid(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  periodEnd: z.string().min(8),
});

export async function setOrganizationSubscription(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = periodSchema.safeParse({
    organizationId: formData.get('organizationId'),
    planId: formData.get('planId'),
    status: formData.get('status'),
    billingCycle: formData.get('billingCycle'),
    periodEnd: formData.get('periodEnd'),
  });

  if (!parsed.success) {
    return { error: 'Abonelik alanlarını kontrol edin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, planId, status, billingCycle, periodEnd } = parsed.data;
    const endDate = new Date(periodEnd);
    if (Number.isNaN(endDate.getTime())) {
      return { error: 'Geçerli bir bitiş tarihi girin.' };
    }

    const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) {
      return { error: 'Plan bulunamadı.' };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { error: 'Abonelik kaydı bulunamadı.' };
    }

    const licenseStatus =
      status === 'TRIALING' ? 'TRIAL' : status === 'ACTIVE' ? 'ACTIVE' : 'EXPIRED';

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId,
          status,
          billingCycle,
          trialEndsAt: status === 'TRIALING' ? endDate : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: endDate,
          canceledAt: status === 'CANCELED' ? new Date() : null,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          status:
            status === 'CANCELED' || status === 'EXPIRED'
              ? orgStatusForSubscription(status)
              : 'ACTIVE',
          centralLicenseStatus: licenseStatus,
          licenseExpiresAt: endDate,
        },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: 'SUBSCRIPTION_CHANGED',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: {
          planCode: plan.code,
          status,
          billingCycle,
          periodEnd: endDate.toISOString(),
          updatedBy: 'master_admin',
        },
      });
    });

    revalidateOrg(organizationId);
    return { success: 'Abonelik ve süre güncellendi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Abonelik güncellenemedi.' };
  }
}

function orgStatusForSubscription(status: string) {
  if (status === 'CANCELED' || status === 'EXPIRED') return 'SUSPENDED' as const;
  return 'ACTIVE' as const;
}

const cancelSchema = z.object({
  organizationId: z.string().cuid(),
});

export async function cancelOrganizationSubscription(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = cancelSchema.safeParse({
    organizationId: formData.get('organizationId'),
  });

  if (!parsed.success) {
    return { error: 'Geçersiz organizasyon.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId } = parsed.data;

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
          status: 'CANCELED',
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          centralLicenseStatus: 'REVOKED',
        },
      });

      await writeAdminAuditLog({
        actorId: session.user.id!,
        organizationId,
        action: 'SUBSCRIPTION_CANCELED',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { canceledBy: 'master_admin' },
      });
    });

    revalidateOrg(organizationId);
    return { success: 'Abonelik iptal edildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Abonelik iptal edilemedi.' };
  }
}
