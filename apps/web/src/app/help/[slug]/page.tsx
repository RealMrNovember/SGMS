import { HelpMarkdown } from '@/components/help/help-markdown';
import { auth } from '@/lib/auth';
import { getHelpArticleBySlug } from '@/lib/help/queries';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { slug } = await params;
  const locale = await getLocale();
  const isAthlete = Boolean(session.user.gymMemberId && session.user.role === 'VIEWER');

  const article = await getHelpArticleBySlug({
    slug,
    locale,
    role: session.user.role,
    isAthlete,
    isSuperAdmin: session.user.isSuperAdmin,
  });

  if (!article) {
    notFound();
  }

  const t = await getTranslations('help');
  const homeHref = session.user.isSuperAdmin
    ? '/admin'
    : isAthlete
      ? '/athlete'
      : '/dashboard';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/help" className="muted text-sm hover:text-white">
          {t('backToHub')}
        </Link>
        {' · '}
        <Link href={homeHref} className="muted text-sm hover:text-white">
          {t('backHome')}
        </Link>
      </div>

      <article className="card space-y-5 p-6">
        <div>
          <p className="muted text-xs uppercase tracking-wide">
            {t.has(`categories.${article.category}`)
              ? t(`categories.${article.category}`)
              : article.category}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h1>
        </div>
        <HelpMarkdown source={article.bodyMarkdown} />
      </article>
    </div>
  );
}
