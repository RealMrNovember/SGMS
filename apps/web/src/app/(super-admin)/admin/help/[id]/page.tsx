import { HelpArticleForm } from '@/components/admin/help-article-form';
import { getHelpArticleAdmin } from '@/lib/help/queries';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function AdminHelpEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getHelpArticleAdmin(id);
  if (!article) notFound();

  const preferred =
    article.translations.find((t) => t.locale === 'tr') ??
    article.translations.find((t) => t.locale === 'en') ??
    article.translations[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/help" className="muted text-sm hover:text-white">
          ← Kılavuz listesi
        </Link>
        <h2 className="mt-3 text-2xl font-semibold">Kılavuz düzenle</h2>
        <p className="muted mt-1 text-sm">{article.slug}</p>
      </div>
      <HelpArticleForm
        initial={{
          id: article.id,
          slug: article.slug,
          category: article.category,
          sortOrder: article.sortOrder,
          isPublished: article.isPublished,
          isOnboardingGuide: article.isOnboardingGuide,
          onboardingKey: article.onboardingKey ?? '',
          relatedFeatureFlag: article.relatedFeatureFlag ?? '',
          audiences: article.audiences,
          locale: preferred?.locale ?? 'tr',
          title: preferred?.title ?? '',
          bodyMarkdown: preferred?.bodyMarkdown ?? '',
        }}
      />
    </div>
  );
}
