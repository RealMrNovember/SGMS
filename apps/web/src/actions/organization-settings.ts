'use server';

import { auth } from '@/lib/auth';
import {
  parseOrganizationSettings,
  type OrganizationSettings,
} from '@/lib/admin/org-settings';
import { normalizeAppLocale } from '@/lib/org-locale';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type OrganizationSettingsState = {
  error?: string;
  success?: string;
};

const settingsSchema = z.object({
  defaultLocale: z.enum(['tr', 'en', 'ru', 'fr', 'es', 'az']),
  typingIndicator: z.enum(['on', 'off']).optional(),
  messageReports: z.enum(['on', 'off']).optional(),
  signedAvatarUrls: z.enum(['on', 'off']).optional(),
  tokenRevokeRedisCache: z.enum(['on', 'off']).optional(),
});

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

export async function updateOrganizationSettings(
  _prev: OrganizationSettingsState,
  formData: FormData,
): Promise<OrganizationSettingsState> {
  const hasFeatureFields =
    formData.has('typingIndicator') ||
    formData.has('messageReports') ||
    formData.has('signedAvatarUrls') ||
    formData.has('tokenRevokeRedisCache');

  const parsed = settingsSchema.safeParse({
    defaultLocale: formData.get('defaultLocale'),
    typingIndicator: formData.get('typingIndicator') ?? undefined,
    messageReports: formData.get('messageReports') ?? undefined,
    signedAvatarUrls: formData.get('signedAvatarUrls') ?? undefined,
    tokenRevokeRedisCache: formData.get('tokenRevokeRedisCache') ?? undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz ayar değerleri.' };
  }

  try {
    const session = await requireOrgAdmin();
    const organizationId = session.user.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!org) {
      return { error: 'Salon bulunamadı.' };
    }

    const current = parseOrganizationSettings(org.settings);
    const locale = normalizeAppLocale(parsed.data.defaultLocale) ?? 'tr';

    const nextSettings: OrganizationSettings = {
      ...current,
      defaultLocale: locale,
      features: hasFeatureFields
        ? {
            ...current.features,
            typingIndicator:
              parsed.data.typingIndicator != null
                ? parsed.data.typingIndicator !== 'off'
                : current.features?.typingIndicator,
            messageReports:
              parsed.data.messageReports != null
                ? parsed.data.messageReports !== 'off'
                : current.features?.messageReports,
            signedAvatarUrls:
              parsed.data.signedAvatarUrls != null
                ? parsed.data.signedAvatarUrls === 'on'
                : current.features?.signedAvatarUrls,
            tokenRevokeRedisCache:
              parsed.data.tokenRevokeRedisCache != null
                ? parsed.data.tokenRevokeRedisCache === 'on'
                : current.features?.tokenRevokeRedisCache,
          }
        : current.features,
    };

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      }),
      prisma.auditLog.create({
        data: {
          organizationId,
          actorId: session.user.id,
          action: 'SETTINGS_CHANGED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: {
            defaultLocale: locale,
            features: nextSettings.features,
          },
        },
      }),
    ]);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/team');

    return { success: 'Salon ayarları kaydedildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.' };
  }
}
