import { TrialRegistrationForm } from '@/components/marketing/trial-registration-form';
import { MarketingReveal, MarketingStagger } from '@/components/marketing/marketing-motion';
import { SgmsLogo } from '@/components/brand/sgms-logo';
import { siteConfig } from '@/lib/site-config';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function TrialPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  const t = await getTranslations('marketing.trialPage');

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-5 sm:gap-10 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:py-16">
      <section className="space-y-6">
        <MarketingReveal immediate>
          <Link href="/" className="muted inline-flex text-sm hover:text-white">
            ← {t('backHome')}
          </Link>
        </MarketingReveal>
        <MarketingReveal immediate delay={80}>
          <SgmsLogo size="lg" href="/" />
        </MarketingReveal>
        <MarketingReveal immediate delay={160}>
          <p className="marketing-kicker">{t('kicker')}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {t('title', { days: siteConfig.trialDays })}
          </h1>
          <p className="muted max-w-lg text-sm leading-7">{t('subtitle')}</p>
        </MarketingReveal>

        <MarketingStagger className="space-y-4 pt-2" staggerMs={90} immediate>
          {(['item1', 'item2', 'item3', 'item4'] as const).map((key) => (
            <li key={key} className="trial-benefit-item flex list-none gap-3 text-sm">
              <span className="text-[#c9a962]">◆</span>
              <span className="muted leading-7">{t(`includes.${key}`)}</span>
            </li>
          ))}
        </MarketingStagger>

        <MarketingReveal delay={400}>
          <p className="muted text-xs leading-6">{t('disclaimer')}</p>
        </MarketingReveal>
      </section>

      <MarketingReveal variant="scale-in" delay={200}>
        <TrialRegistrationForm />
      </MarketingReveal>
    </div>
  );
}
