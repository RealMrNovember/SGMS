import { LocaleSwitcher } from '@/components/locale-switcher';
import { SgmsLogo } from '@/components/brand/sgms-logo';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function MarketingHeader() {
  const t = await getTranslations('marketing.nav');

  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <SgmsLogo size="sm" />

        <nav className="marketing-header-nav" aria-label="Primary">
          <a href="#features" className="marketing-nav-link">
            {t('features')}
          </a>
          <a href="#how-it-works" className="marketing-nav-link">
            {t('howItWorks')}
          </a>
          <a href="#why-sgms" className="marketing-nav-link">
            {t('why')}
          </a>
          <a href="#reception-desktop" className="marketing-nav-link">
            {t('receptionDesktop')}
          </a>
          <a href="#contact" className="marketing-nav-link">
            {t('contact')}
          </a>
        </nav>

        <div className="marketing-header-actions">
          <LocaleSwitcher compact />
          <Link href="/login" className="marketing-auth-btn marketing-auth-btn--ghost">
            <span className="marketing-auth-short">{t('loginShort')}</span>
            <span className="marketing-auth-full">{t('login')}</span>
          </Link>
          <Link href="/trial" className="marketing-auth-btn marketing-auth-btn--gold">
            <span className="marketing-auth-short">{t('trialShort')}</span>
            <span className="marketing-auth-full">{t('trial')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
