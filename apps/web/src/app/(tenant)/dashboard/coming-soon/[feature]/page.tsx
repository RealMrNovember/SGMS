import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const FEATURE_ICONS: Record<string, string> = {
  hr: '🗂️',
  equipment: '🛠️',
  cleaning: '🧹',
  cashShifts: '💵',
  digitalCard: '📱',
  notifications: '🔔',
  insights: '🤖',
  enterprise: '🏢',
  integrations: '🔌',
  helpCenter: '📖',
};

const VALID_FEATURES = Object.keys(FEATURE_ICONS);

export async function generateStaticParams() {
  return VALID_FEATURES.map((feature) => ({ feature }));
}

export default async function ComingSoonFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const session = await auth();

  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  if (!VALID_FEATURES.includes(feature)) {
    notFound();
  }

  const t = await getTranslations('comingSoon');

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8 text-center">
      <Link href="/dashboard" className="muted inline-block text-sm hover:text-white">
        {t('backToOverview')}
      </Link>

      <div className="card space-y-5 p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c9a962]/30 bg-[#c9a962]/10 text-3xl">
          {FEATURE_ICONS[feature]}
        </span>

        <div>
          <p className="text-xs tracking-[0.16em] text-[#c9a962] uppercase">{t('eyebrow')}</p>
          <h1 className="mt-2 text-2xl font-semibold">{t(`features.${feature}.title`)}</h1>
        </div>

        <span className="badge mx-auto inline-block">{t('badge')}</span>

        <p className="muted mx-auto max-w-md text-sm leading-7">
          {t(`features.${feature}.description`)}
        </p>

        <p className="muted mx-auto max-w-md border-t border-[var(--border)] pt-5 text-xs leading-6">
          {t('footer')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/dashboard" className="button px-5 py-2.5 text-sm">
            {t('backToOverview')}
          </Link>
          <Link href="/#roadmap" className="button button-outline-gold px-5 py-2.5 text-sm">
            {t('seeRoadmap')}
          </Link>
        </div>
      </div>
    </div>
  );
}
