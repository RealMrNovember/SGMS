import { getMobileAthleteDownloadUrl, getMobilePlayStoreUrl, mobileAthleteRelease } from '@/lib/mobile-app';
import { resolveLatestReleaseVersion } from '@/lib/github-releases';
import { MarketingReveal, MarketingStagger } from '@/components/marketing/marketing-motion';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

const SHOWCASE_SHOTS = [
  { src: '/marketing/sgms-sporcu/phone-01-giris.webp', key: 'login' as const },
  { src: '/marketing/sgms-sporcu/phone-02-ana-sayfa.webp', key: 'home' as const },
  { src: '/marketing/sgms-sporcu/phone-03-programlar.webp', key: 'programs' as const },
  { src: '/marketing/sgms-sporcu/phone-04-olcumler.webp', key: 'measurements' as const },
  { src: '/marketing/sgms-sporcu/phone-05-hesap.webp', key: 'account' as const },
  { src: '/marketing/sgms-sporcu/phone-06-mesajlar.webp', key: 'messages' as const },
] as const;

const HIGHLIGHT_KEYS = ['membership', 'programs', 'checkin', 'store'] as const;

/**
 * Showcase landing — SGMS Sporcu full-bleed promo (Play + APK).
 * Visual anchor: real store screenshots; brand name is hero of the section.
 */
export async function MobileAthleteShowcase() {
  const t = await getTranslations('mobileAthlete');
  const downloadUrl = getMobileAthleteDownloadUrl();
  const playStoreUrl = getMobilePlayStoreUrl();
  const version =
    (await resolveLatestReleaseVersion('mobile-v', '.apk')) ?? mobileAthleteRelease.version;

  return (
    <section id="sgms-sporcu" className="mobile-showcase" aria-labelledby="sgms-sporcu-title">
      <div className="mobile-showcase__glow" aria-hidden />
      <div className="mobile-showcase__inner">
        <div className="mobile-showcase__copy">
          <MarketingReveal>
            <div className="mobile-showcase__brand-row">
              <Image
                src="/marketing/sgms-sporcu/icon-192.png"
                alt=""
                width={56}
                height={56}
                className="mobile-showcase__icon"
              />
              <div>
                <p className="marketing-kicker">{t('showcase.kicker')}</p>
                <h2 id="sgms-sporcu-title" className="mobile-showcase__title">
                  {t('title')}
                </h2>
              </div>
            </div>
          </MarketingReveal>

          <MarketingReveal delay={100}>
            <p className="mobile-showcase__subtitle">{t('showcase.subtitle')}</p>
          </MarketingReveal>

          <MarketingStagger className="mobile-showcase__highlights" staggerMs={70}>
            {HIGHLIGHT_KEYS.map((key) => (
              <p key={key} className="mobile-showcase__highlight">
                {t(`showcase.highlights.${key}`)}
              </p>
            ))}
          </MarketingStagger>

          <MarketingReveal delay={220}>
            <div className="mobile-showcase__actions">
              <a
                href={playStoreUrl}
                className="button button-gold marketing-cta-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('showcase.ctaPlay')}
              </a>
              <a
                href={downloadUrl}
                className="button-outline-gold marketing-cta-btn"
                download={mobileAthleteRelease.fileName}
                rel="noopener noreferrer"
              >
                {t('download', { version })}
              </a>
            </div>
            <p className="muted mt-3 text-xs leading-6">{t('showcase.playHint')}</p>
            <p className="muted mt-1 text-xs">
              {t('size', { size: mobileAthleteRelease.sizeLabel, platform: mobileAthleteRelease.platform })}
            </p>
          </MarketingReveal>
        </div>

        <MarketingReveal delay={80} variant="slide-right" className="mobile-showcase__stage">
          <div className="mobile-showcase__feature" aria-hidden>
            <Image
              src="/marketing/sgms-sporcu/feature-graphic.png"
              alt=""
              width={1024}
              height={500}
              className="mobile-showcase__feature-img"
              priority={false}
            />
          </div>
          <ul className="mobile-showcase__phones">
            {SHOWCASE_SHOTS.map((shot, index) => (
              <li
                key={shot.key}
                className={`mobile-showcase__phone mobile-showcase__phone--${index + 1}`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Image
                  src={shot.src}
                  alt={t(`showcase.shots.${shot.key}`)}
                  width={540}
                  height={960}
                  className="mobile-showcase__phone-img"
                  sizes="(max-width: 768px) 42vw, 180px"
                />
              </li>
            ))}
          </ul>
        </MarketingReveal>
      </div>

      <div className="mobile-showcase__footer-link">
        <Link href="/trial" className="text-sm text-[#e8d5a3] underline-offset-4 hover:underline">
          {t('showcase.trialLink')}
        </Link>
      </div>
    </section>
  );
}
