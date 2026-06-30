import { LocaleSwitcher } from '@/components/locale-switcher';
import { SgmsLogo } from '@/components/brand/sgms-logo';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function MarketingHeader() {
  const t = await getTranslations('marketing.nav');

  return (
    <header className="marketing-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <SgmsLogo size="sm" />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          <a href="#features" className="marketing-nav-link">
            {t('features')}
          </a>
          <a href="#how-it-works" className="marketing-nav-link">
            {t('howItWorks')}
          </a>
          <a href="#why-sgms" className="marketing-nav-link">
            {t('why')}
          </a>
          <a href="#contact" className="marketing-nav-link">
            {t('contact')}
          </a>
          <a href="#reception-desktop" className="marketing-nav-link">
            {t('receptionDesktop')}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link href="/login" className="button-outline-gold hidden px-4 py-2 text-sm sm:inline-flex">
            {t('login')}
          </Link>
          <Link href="/trial" className="button button-gold px-4 py-2 text-sm">
            {t('trial')}
          </Link>
        </div>
      </div>
    </header>
  );
}
