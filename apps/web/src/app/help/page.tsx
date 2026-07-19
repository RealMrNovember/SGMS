import { HelpSearchForm } from '@/components/help/help-search-form';
import { auth } from '@/lib/auth';
import {
  groupArticlesByCategory,
  listHelpArticlesForViewer,
  listOnboardingGuides,
} from '@/lib/help/queries';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function HelpHubPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const isAthlete = Boolean(session.user.gymMemberId && session.user.role === 'VIEWER');
  const isStaff = Boolean(session.user.organizationId && session.user.role && session.user.role !== 'VIEWER');
  if (!isAthlete && !isStaff && !session.user.isSuperAdmin) {
    redirect('/login');
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const locale = await getLocale();
  const t = await getTranslations('help');

  const [articles, guides] = await Promise.all([
    listHelpArticlesForViewer({
      locale,
      role: session.user.role,
      isAthlete,
      isSuperAdmin: session.user.isSuperAdmin,
      query: q || undefined,
    }),
    q
      ? Promise.resolve([])
      : listOnboardingGuides({
          locale,
          role: session.user.role,
          isAthlete,
        }),
  ]);

  const grouped = groupArticlesByCategory(articles.filter((a) => !a.isOnboardingGuide || Boolean(q)));
  const homeHref = session.user.isSuperAdmin
    ? '/admin'
    : isAthlete
      ? '/athlete'
      : '/dashboard';

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={homeHref} className="muted text-sm hover:text-white">
            {t('backHome')}
          </Link>
            <div className="mt-3 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          </div>
          <p className="muted mt-2 max-w-2xl text-sm leading-6">{t('subtitle')}</p>
        </div>
      </section>

      <section className="card p-5">
        <HelpSearchForm initialQuery={q} />
      </section>

      {!q && guides.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('onboardingTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((guide) => (
              <Link
                key={guide.id}
                href={`/help/${guide.slug}`}
                className="card block p-5 transition hover:border-[var(--gold)]/40"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--gold)]">
                  {t('onboardingBadge')}
                </p>
                <h3 className="mt-2 font-semibold">{guide.title}</h3>
                <p className="muted mt-2 text-sm leading-6">{guide.excerpt}…</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        {articles.length === 0 ? (
          <p className="muted text-sm">{t('empty')}</p>
        ) : (
          Array.from(grouped.entries()).map(([category, rows]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-semibold">
                {t.has(`categories.${category}`) ? t(`categories.${category}`) : category}
              </h2>
              <ul className="space-y-2">
                {rows.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/help/${article.slug}`}
                      className="card flex flex-col gap-1 p-4 hover:border-[var(--gold)]/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium">{article.title}</span>
                      <span className="muted text-xs">{article.excerpt.slice(0, 80)}…</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
