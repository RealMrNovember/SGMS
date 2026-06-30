import { auth } from '@/lib/auth';
import { siteConfig } from '@/lib/site-config';
import { ReceptionDownloadPromo } from '@/components/reception/reception-download-promo';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const FEATURE_KEYS = ['crm', 'programs', 'pos', 'i18n', 'mobile', 'realtime'] as const;
const STAT_KEYS = ['members', 'languages', 'uptime', 'trial'] as const;
const STEP_KEYS = ['register', 'setup', 'operate'] as const;
const WHY_KEYS = ['fragmented', 'international', 'finance', 'athlete'] as const;

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

  return (
    <>
      <section className="marketing-hero relative">
        <div className="marketing-grid-glow" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <p className="marketing-kicker">{t('hero.kicker')}</p>
          <h1 className="marketing-title mt-5">{t('hero.title')}</h1>
          <p className="marketing-subtitle mt-6">{t('hero.subtitle')}</p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/trial" className="button button-gold px-6 py-3 text-sm">
              {t('hero.ctaTrial', { days: siteConfig.trialDays })}
            </Link>
            <Link href="/login" className="button-outline-gold px-6 py-3 text-sm">
              {t('hero.ctaLogin')}
            </Link>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_KEYS.map((key) => (
              <div key={key} className="marketing-stat">
                <p className="marketing-stat-value">{t(`stats.${key}.value`)}</p>
                <p className="muted mt-1 text-sm">{t(`stats.${key}.label`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="marketing-kicker">{t('features.kicker')}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">{t('features.title')}</h2>
          <p className="muted mt-4 text-sm leading-7">{t('features.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <article key={key} className="marketing-feature-card">
              <span className="marketing-feature-icon" aria-hidden>
                {t(`features.items.${key}.icon`)}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{t(`features.items.${key}.title`)}</h3>
              <p className="muted mt-2 text-sm leading-7">{t(`features.items.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <ReceptionDownloadPromo variant="marketing" />

      <section id="why-sgms" className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        <div className="marketing-cta-band p-8 md:p-10">
          <p className="marketing-kicker">{t('why.kicker')}</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">{t('why.title')}</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {WHY_KEYS.map((key) => (
              <li key={key} className="rounded-xl border border-[rgba(148,163,184,0.12)] bg-[rgba(11,18,32,0.55)] p-5">
                <h3 className="font-medium">{t(`why.items.${key}.title`)}</h3>
                <p className="muted mt-2 text-sm leading-7">{t(`why.items.${key}.description`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <p className="marketing-kicker">{t('how.kicker')}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">{t('how.title')}</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {STEP_KEYS.map((key, index) => (
            <article key={key} className="marketing-step" data-step={String(index + 1).padStart(2, '0')}>
              <h3 className="text-lg font-semibold">{t(`how.steps.${key}.title`)}</h3>
              <p className="muted mt-2 text-sm leading-7">{t(`how.steps.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8">
        <div className="marketing-cta-band flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold md:text-3xl">{t('cta.title', { days: siteConfig.trialDays })}</h2>
            <p className="muted mt-3 text-sm leading-7">{t('cta.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/trial" className="button button-gold px-6 py-3 text-sm">
              {t('cta.buttonTrial')}
            </Link>
            <Link href="/login" className="button-outline-gold px-6 py-3 text-sm">
              {t('cta.buttonLogin')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
