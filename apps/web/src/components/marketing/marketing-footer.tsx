import { SgmsLogo } from '@/components/brand/sgms-logo';
import { MarketingReveal } from '@/components/marketing/marketing-motion';
import { siteConfig } from '@/lib/site-config';
import { getReceptionDesktopDownloadUrl, receptionDesktopRelease } from '@/lib/reception-desktop';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const tDesktop = await getTranslations('receptionDesktop');
  const downloadUrl = getReceptionDesktopDownloadUrl();

  return (
    <footer id="contact" className="marketing-footer mt-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <MarketingReveal>
          <div className="space-y-4">
            <SgmsLogo size="sm" href={null} />
            <p className="muted max-w-sm text-sm leading-7">{t('description')}</p>
            <p className="text-xs tracking-[0.16em] text-[#c9a962] uppercase">{siteConfig.company}</p>
          </div>
        </MarketingReveal>

        <MarketingReveal delay={100}>
          <div>
            <h3 className="text-sm font-semibold">{t('productTitle')}</h3>
            <ul className="muted mt-4 space-y-2 text-sm">
              <li>
                <a href="#features">{t('features')}</a>
              </li>
              <li>
                <Link href="/trial">{t('trial')}</Link>
              </li>
              <li>
                <Link href="/login">{t('login')}</Link>
              </li>
              <li>
                <a
                  href={downloadUrl}
                  download={receptionDesktopRelease.fileName}
                  rel="noopener noreferrer"
                >
                  {tDesktop('footerLink')}
                </a>
              </li>
            </ul>
          </div>
        </MarketingReveal>

        <MarketingReveal delay={200}>
          <div>
            <h3 className="text-sm font-semibold">{t('contactTitle')}</h3>
            <ul className="muted mt-4 space-y-2 text-sm">
              <li>
                <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>
              </li>
              <li>
                <a href={`mailto:${siteConfig.contact.support}`}>{siteConfig.contact.support}</a>
              </li>
              <li>
                <a href={siteConfig.contact.website} target="_blank" rel="noopener noreferrer">
                  {siteConfig.contact.website.replace('https://', '')}
                </a>
              </li>
              <li>{siteConfig.contact.address}</li>
            </ul>
          </div>
        </MarketingReveal>
      </div>

      <div className="border-t border-[rgba(201,169,98,0.1)] px-5 py-5 text-center">
        <p className="muted text-xs">
          © {new Date().getFullYear()} {siteConfig.company}. {t('rights')}
          {' · '}
          <Link href="/privacy" className="hover:text-white">
            Gizlilik Politikası
          </Link>
          {' · '}
          <Link href="/terms" className="hover:text-white">
            Kullanım Şartları
          </Link>
        </p>
      </div>
    </footer>
  );
}
