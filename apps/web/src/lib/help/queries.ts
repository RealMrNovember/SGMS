import { prisma } from '@/lib/prisma';
import {
  audiencesForViewer,
  preferredTranslationLocales,
  type HelpCategory,
} from '@/lib/help/types';
import type { HelpAudience, OrganizationRole, Prisma } from '@sgms/database';

export type HelpArticleListItem = {
  id: string;
  slug: string;
  category: string;
  sortOrder: number;
  isOnboardingGuide: boolean;
  onboardingKey: string | null;
  relatedFeatureFlag: string | null;
  audiences: HelpAudience[];
  title: string;
  excerpt: string;
  locale: string;
};

export type HelpArticleDetail = HelpArticleListItem & {
  bodyMarkdown: string;
};

function pickTranslation<T extends { locale: string; title: string; bodyMarkdown: string }>(
  translations: T[],
  locale: string,
): T | null {
  const preferred = preferredTranslationLocales(locale);
  for (const code of preferred) {
    const hit = translations.find((t) => t.locale === code);
    if (hit) return hit;
  }
  return translations[0] ?? null;
}

function toListItem(
  article: {
    id: string;
    slug: string;
    category: string;
    sortOrder: number;
    isOnboardingGuide: boolean;
    onboardingKey: string | null;
    relatedFeatureFlag: string | null;
    audiences: HelpAudience[];
    translations: Array<{ locale: string; title: string; bodyMarkdown: string }>;
  },
  locale: string,
): HelpArticleListItem | null {
  const tr = pickTranslation(article.translations, locale);
  if (!tr) return null;
  const excerpt = tr.bodyMarkdown.replace(/[#*`>\-]/g, '').trim().slice(0, 160);
  return {
    id: article.id,
    slug: article.slug,
    category: article.category,
    sortOrder: article.sortOrder,
    isOnboardingGuide: article.isOnboardingGuide,
    onboardingKey: article.onboardingKey,
    relatedFeatureFlag: article.relatedFeatureFlag,
    audiences: article.audiences,
    title: tr.title,
    excerpt,
    locale: tr.locale,
  };
}

export async function listHelpArticlesForViewer(params: {
  locale: string;
  role?: OrganizationRole | null;
  isAthlete?: boolean;
  isSuperAdmin?: boolean;
  query?: string;
  category?: string;
  publishedOnly?: boolean;
}): Promise<HelpArticleListItem[]> {
  const audiences = audiencesForViewer(params);
  const q = params.query?.trim();

  const where: Prisma.HelpArticleWhereInput = {
    ...(params.publishedOnly !== false ? { isPublished: true } : {}),
    ...(params.isSuperAdmin ? {} : { audiences: { hasSome: audiences } }),
    ...(params.category ? { category: params.category } : {}),
    ...(q
      ? {
          translations: {
            some: {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { bodyMarkdown: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  };

  const rows = await prisma.helpArticle.findMany({
    where,
    orderBy: [{ isOnboardingGuide: 'desc' }, { sortOrder: 'asc' }, { slug: 'asc' }],
    include: { translations: true },
  });

  return rows
    .map((row) => toListItem(row, params.locale))
    .filter((row): row is HelpArticleListItem => row != null);
}

export async function getHelpArticleBySlug(params: {
  slug: string;
  locale: string;
  role?: OrganizationRole | null;
  isAthlete?: boolean;
  isSuperAdmin?: boolean;
  publishedOnly?: boolean;
}): Promise<HelpArticleDetail | null> {
  const audiences = audiencesForViewer(params);
  const article = await prisma.helpArticle.findFirst({
    where: {
      slug: params.slug,
      ...(params.publishedOnly !== false ? { isPublished: true } : {}),
      ...(params.isSuperAdmin ? {} : { audiences: { hasSome: audiences } }),
    },
    include: { translations: true },
  });
  if (!article) return null;
  const item = toListItem(article, params.locale);
  if (!item) return null;
  const tr = pickTranslation(article.translations, params.locale);
  return {
    ...item,
    bodyMarkdown: tr?.bodyMarkdown ?? '',
  };
}

export async function listOnboardingGuides(params: {
  locale: string;
  role?: OrganizationRole | null;
  isAthlete?: boolean;
}): Promise<HelpArticleListItem[]> {
  const all = await listHelpArticlesForViewer({
    ...params,
    publishedOnly: true,
  });
  return all.filter((a) => a.isOnboardingGuide);
}

export async function listAllHelpArticlesAdmin() {
  return prisma.helpArticle.findMany({
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    include: {
      translations: { orderBy: { locale: 'asc' } },
    },
  });
}

export async function getHelpArticleAdmin(id: string) {
  return prisma.helpArticle.findUnique({
    where: { id },
    include: { translations: { orderBy: { locale: 'asc' } } },
  });
}

export function groupArticlesByCategory(articles: HelpArticleListItem[]) {
  const map = new Map<string, HelpArticleListItem[]>();
  for (const article of articles) {
    const key = article.category || 'general';
    const list = map.get(key) ?? [];
    list.push(article);
    map.set(key, list);
  }
  return map;
}

export type { HelpCategory };
