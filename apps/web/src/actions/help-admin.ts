'use server';

import { auth } from '@/lib/auth';
import { HELP_LOCALES } from '@/lib/help/types';
import { prisma } from '@/lib/prisma';
import type { HelpAudience } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type HelpAdminState = {
  error?: string;
  success?: string;
  articleId?: string;
};

const audienceEnum = z.enum(['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'ATHLETE', 'RECEPTION']);

const articleSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug yalnızca küçük harf, rakam ve tire olabilir.'),
  category: z.string().min(2).max(40),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isPublished: z.enum(['on', 'off']).optional(),
  isOnboardingGuide: z.enum(['on', 'off']).optional(),
  onboardingKey: z.string().max(40).optional(),
  relatedFeatureFlag: z.string().max(60).optional(),
  audiences: z.array(audienceEnum).min(1),
  locale: z.enum(HELP_LOCALES as unknown as [string, ...string[]]),
  title: z.string().min(2).max(200),
  bodyMarkdown: z.string().min(10).max(50_000),
});

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Yalnızca Master Admin.');
  }
  return session;
}

function parseAudiences(formData: FormData): HelpAudience[] {
  return formData
    .getAll('audiences')
    .map(String)
    .filter((v): v is HelpAudience =>
      ['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'ATHLETE', 'RECEPTION'].includes(v),
    );
}

export async function createHelpArticle(
  _prev: HelpAdminState,
  formData: FormData,
): Promise<HelpAdminState> {
  const parsed = articleSchema.safeParse({
    slug: formData.get('slug'),
    category: formData.get('category'),
    sortOrder: formData.get('sortOrder') ?? 0,
    isPublished: formData.get('isPublished') === 'on' ? 'on' : 'off',
    isOnboardingGuide: formData.get('isOnboardingGuide') === 'on' ? 'on' : 'off',
    onboardingKey: String(formData.get('onboardingKey') || '') || undefined,
    relatedFeatureFlag: String(formData.get('relatedFeatureFlag') || '') || undefined,
    audiences: parseAudiences(formData),
    locale: formData.get('locale') || 'tr',
    title: formData.get('title'),
    bodyMarkdown: formData.get('bodyMarkdown'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz kılavuz verisi.' };
  }

  try {
    const session = await requireSuperAdmin();
    const article = await prisma.helpArticle.create({
      data: {
        slug: parsed.data.slug,
        category: parsed.data.category,
        sortOrder: parsed.data.sortOrder,
        isPublished: parsed.data.isPublished !== 'off',
        isOnboardingGuide: parsed.data.isOnboardingGuide === 'on',
        onboardingKey: parsed.data.onboardingKey ?? null,
        relatedFeatureFlag: parsed.data.relatedFeatureFlag ?? null,
        audiences: parsed.data.audiences,
        translations: {
          create: {
            locale: parsed.data.locale,
            title: parsed.data.title,
            bodyMarkdown: parsed.data.bodyMarkdown,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: 'HELP_ARTICLE_CREATED',
        entityType: 'help_article',
        entityId: article.id,
        metadata: { slug: article.slug },
      },
    });

    revalidatePath('/admin/help');
    revalidatePath('/help');
    return { success: 'Kılavuz oluşturuldu.', articleId: article.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique')) {
      return { error: 'Bu slug zaten kullanılıyor.' };
    }
    return { error: error instanceof Error ? error.message : 'Kayıt başarısız.' };
  }
}

export async function updateHelpArticle(
  _prev: HelpAdminState,
  formData: FormData,
): Promise<HelpAdminState> {
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'Makale kimliği gerekli.' };

  const parsed = articleSchema.safeParse({
    slug: formData.get('slug'),
    category: formData.get('category'),
    sortOrder: formData.get('sortOrder') ?? 0,
    isPublished: formData.get('isPublished') === 'on' ? 'on' : 'off',
    isOnboardingGuide: formData.get('isOnboardingGuide') === 'on' ? 'on' : 'off',
    onboardingKey: String(formData.get('onboardingKey') || '') || undefined,
    relatedFeatureFlag: String(formData.get('relatedFeatureFlag') || '') || undefined,
    audiences: parseAudiences(formData),
    locale: formData.get('locale') || 'tr',
    title: formData.get('title'),
    bodyMarkdown: formData.get('bodyMarkdown'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz kılavuz verisi.' };
  }

  try {
    const session = await requireSuperAdmin();
    await prisma.$transaction(async (tx) => {
      await tx.helpArticle.update({
        where: { id },
        data: {
          slug: parsed.data.slug,
          category: parsed.data.category,
          sortOrder: parsed.data.sortOrder,
          isPublished: parsed.data.isPublished !== 'off',
          isOnboardingGuide: parsed.data.isOnboardingGuide === 'on',
          onboardingKey: parsed.data.onboardingKey ?? null,
          relatedFeatureFlag: parsed.data.relatedFeatureFlag ?? null,
          audiences: parsed.data.audiences,
        },
      });
      await tx.helpArticleTranslation.upsert({
        where: {
          articleId_locale: { articleId: id, locale: parsed.data.locale },
        },
        create: {
          articleId: id,
          locale: parsed.data.locale,
          title: parsed.data.title,
          bodyMarkdown: parsed.data.bodyMarkdown,
        },
        update: {
          title: parsed.data.title,
          bodyMarkdown: parsed.data.bodyMarkdown,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'HELP_ARTICLE_UPDATED',
          entityType: 'help_article',
          entityId: id,
          metadata: { slug: parsed.data.slug, locale: parsed.data.locale },
        },
      });
    });

    revalidatePath('/admin/help');
    revalidatePath(`/admin/help/${id}`);
    revalidatePath('/help');
    revalidatePath(`/help/${parsed.data.slug}`);
    return { success: 'Kılavuz güncellendi.', articleId: id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Güncelleme başarısız.' };
  }
}

export async function deleteHelpArticle(articleId: string): Promise<HelpAdminState> {
  try {
    const session = await requireSuperAdmin();
    const article = await prisma.helpArticle.delete({ where: { id: articleId } });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: 'HELP_ARTICLE_DELETED',
        entityType: 'help_article',
        entityId: articleId,
        metadata: { slug: article.slug },
      },
    });
    revalidatePath('/admin/help');
    revalidatePath('/help');
    return { success: 'Kılavuz silindi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Silme başarısız.' };
  }
}
