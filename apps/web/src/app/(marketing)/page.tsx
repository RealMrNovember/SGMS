import { auth } from '@/lib/auth';
import { siteConfig } from '@/lib/site-config';
import { ReceptionDownloadPromo } from '@/components/reception/reception-download-promo';
import {
  MarketingHeroScene,
  MarketingReveal,
  MarketingStagger,
} from '@/components/marketing/marketing-motion';
import { MarketingStepsGrid } from '@/components/marketing/marketing-steps-grid';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const FEATURE_KEYS = ['crm', 'programs', 'pt', 'pos', 'reports', 'enterprise', 'i18n', 'mobile', 'realtime'] as const;
const STAT_KEYS = ['members', 'languages', 'uptime', 'trial'] as const;
const STEP_KEYS = ['register', 'setup', 'operate'] as const;
const WHY_KEYS = ['fragmented', 'international', 'finance', 'athlete'] as const;

const ROADMAP_ICONS: Record<string, string> = {
  hr: '🗂️',
  equipment: '🛠️',
  cleaning: '🧹',
  cashShifts: '💵',
  digitalCard: '📱',
  notifications: '🔔',
  insights: '🤖',
  integrations: '🔌',
  helpCenter: '📖',
};
const ROADMAP_KEYS = Object.keys(ROADMAP_ICONS) as (keyof typeof ROADMAP_ICONS)[];

export default async function ShowcaseHomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(
      session.user.isSuperAdmin
        ? '/admin'
        : session.user.gymMemberId && session.user.role === 'VIEWER'
          ? '/athlete'
          : '/dashboard',
    );
  }

  const t = await getTranslations('marketing');
  const tComingSoon = await getTranslations('comingSoon');

  return (
    <>
      <section className="marketing-hero relative">
        <MarketingHeroScene />
        <div className="marketing-grid-glow" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-5 lg:px-8">
          <MarketingReveal immediate delay={0}>
            <p className="marketing-kicker">{t('hero.kicker')}</p>
          </MarketingReveal>
          <MarketingReveal immediate delay={120}>
            <h1 className="marketing-title mt-5">{t('hero.title')}</h1>
          </MarketingReveal>
          <MarketingReveal immediate delay={240}>
            <p className="marketing-subtitle mt-6">{t('hero.subtitle')}</p>
          </MarketingReveal>

          <MarketingReveal immediate delay={360}>
            <div className="marketing-hero-actions mt-10">
              <Link href="/trial" className="button button-gold marketing-cta-btn">
                {t('hero.ctaTrial', { days: siteConfig.trialDays })}
              </Link>
              <Link href="/login" className="button-outline-gold marketing-cta-btn">
                {t('hero.ctaLogin')}
              </Link>
            </div>
          </MarketingReveal>

          <MarketingStagger
            className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            staggerMs={100}
            immediate
          >
            {STAT_KEYS.map((key) => (
              <div key={key} className="marketing-stat">
                <p className="marketing-stat-value">{t(`stats.${key}.value`)}</p>
                <p className="muted mt-1 text-sm">{t(`stats.${key}.label`)}</p>
              </div>
            ))}
          </MarketingStagger>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:px-8">
        <MarketingReveal>
          <div className="max-w-2xl">
            <p className="marketing-kicker">{t('features.kicker')}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t('features.title')}</h2>
            <p className="muted mt-4 text-sm leading-7">{t('features.subtitle')}</p>
          </div>
        </MarketingReveal>

        <MarketingStagger className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3" staggerMs={85}>
          {FEATURE_KEYS.map((key) => (
            <article key={key} className="marketing-feature-card">
              <span className="marketing-feature-icon" aria-hidden>
                {t(`features.items.${key}.icon`)}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{t(`features.items.${key}.title`)}</h3>
              <p className="muted mt-2 text-sm leading-7">{t(`features.items.${key}.description`)}</p>
            </article>
          ))}
        </MarketingStagger>
      </section>

      <ReceptionDownloadPromo variant="marketing" />

      <section id="why-sgms" className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8 lg:px-8">
        <MarketingReveal variant="scale-in">
          <div className="marketing-cta-band p-6 sm:p-8 md:p-10">
            <p className="marketing-kicker">{t('why.kicker')}</p>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{t('why.title')}</h2>
            <MarketingStagger className="mt-8 grid gap-4 md:grid-cols-2" staggerMs={100}>
              {WHY_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-[rgba(148,163,184,0.12)] bg-[rgba(11,18,32,0.55)] p-5"
                >
                  <h3 className="font-medium">{t(`why.items.${key}.title`)}</h3>
                  <p className="muted mt-2 text-sm leading-7">{t(`why.items.${key}.description`)}</p>
                </div>
              ))}
            </MarketingStagger>
          </div>
        </MarketingReveal>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:px-8">
        <MarketingReveal>
          <p className="marketing-kicker">{t('how.kicker')}</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t('how.title')}</h2>
        </MarketingReveal>
        <MarketingStepsGrid>
          {STEP_KEYS.map((key, index) => (
            <MarketingReveal key={key} delay={index * 160} as="article" className="marketing-step" data-step={String(index + 1).padStart(2, '0')}>
              <h3 className="text-lg font-semibold">{t(`how.steps.${key}.title`)}</h3>
              <p className="muted mt-2 text-sm leading-7">{t(`how.steps.${key}.description`)}</p>
            </MarketingReveal>
          ))}
        </MarketingStepsGrid>
      </section>

      <section id="roadmap" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:px-8">
        <MarketingReveal>
          <div className="max-w-2xl">
            <p className="marketing-kicker">{t('roadmap.kicker')}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t('roadmap.title')}</h2>
            <p className="muted mt-4 text-sm leading-7">{t('roadmap.subtitle')}</p>
          </div>
        </MarketingReveal>

        <MarketingStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" staggerMs={60}>
          {ROADMAP_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-[rgba(148,163,184,0.12)] bg-[rgba(11,18,32,0.55)] p-5"
            >
              <span className="text-xl" aria-hidden="true">
                {ROADMAP_ICONS[key]}
              </span>
              <h3 className="mt-3 font-medium">{tComingSoon(`features.${key}.title`)}</h3>
              <p className="muted mt-2 text-sm leading-6">{tComingSoon(`features.${key}.description`)}</p>
              <span className="badge mt-3 inline-block text-[10px]">{tComingSoon('badge')}</span>
            </div>
          ))}
        </MarketingStagger>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-5 lg:px-8 lg:pb-20">
        <MarketingReveal variant="scale-in">
          <div className="marketing-cta-band flex flex-col items-start gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold sm:text-2xl md:text-3xl">
                {t('cta.title', { days: siteConfig.trialDays })}
              </h2>
              <p className="muted mt-3 text-sm leading-7">{t('cta.subtitle')}</p>
            </div>
            <div className="marketing-hero-actions">
              <Link href="/trial" className="button button-gold marketing-cta-btn">
                {t('cta.buttonTrial')}
              </Link>
              <Link href="/login" className="button-outline-gold marketing-cta-btn">
                {t('cta.buttonLogin')}
              </Link>
            </div>
          </div>
        </MarketingReveal>
      </section>
    </>
  );
}
