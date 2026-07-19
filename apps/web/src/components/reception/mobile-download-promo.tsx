import { getMobileAthleteDownloadUrl, mobileAthleteRelease } from '@/lib/mobile-app';
import { resolveLatestReleaseVersion } from '@/lib/github-releases';
import { MarketingReveal } from '@/components/marketing/marketing-motion';
import { getTranslations } from 'next-intl/server';

type Variant = 'marketing' | 'card' | 'compact' | 'duo';

type Props = {
  variant: Variant;
};

export async function MobileDownloadPromo({ variant }: Props) {
  const t = await getTranslations('mobileAthlete');
  const downloadUrl = getMobileAthleteDownloadUrl();
  const version = (await resolveLatestReleaseVersion('mobile-v', '.apk')) ?? mobileAthleteRelease.version;
  const size = mobileAthleteRelease.sizeLabel;
  const platform = mobileAthleteRelease.platform;

  const downloadLabel = t('download', { version });
  const metaLabel = t('size', { size, platform });

  if (variant === 'marketing') {
    return (
      <section id="mobile-athlete" className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:px-8">
        <MarketingReveal variant="scale-in">
          <div className="reception-promo-band">
            <div className="reception-promo-copy">
              <p className="marketing-kicker">{t('badge')}</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t('title')}</h2>
              <p className="muted mt-4 max-w-2xl text-sm leading-7">{t('subtitle')}</p>
              <ul className="reception-promo-features mt-6">
                <li>{t('features.qr')}</li>
                <li>{t('features.fast')}</li>
                <li>{t('features.light')}</li>
              </ul>
            </div>
            <div className="reception-promo-action">
              <span className="reception-promo-version">v{version}</span>
              <a
                href={downloadUrl}
                className="button button-gold marketing-cta-btn reception-promo-download"
                download={mobileAthleteRelease.fileName}
                rel="noopener noreferrer"
              >
                {downloadLabel}
              </a>
              <p className="muted mt-3 text-xs">{metaLabel}</p>
              <p className="muted mt-1 text-xs">{t('unsignedNotice')}</p>
            </div>
          </div>
        </MarketingReveal>
      </section>
    );
  }

  if (variant === 'card') {
    return (
      <section className="reception-promo-card card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.12)] text-[#7dd3fc]">
                {t('badge')}
              </span>
              <span className="muted text-xs">v{version}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{t('title')}</h3>
            <p className="muted mt-2 text-sm leading-7">{t('checkInHint')}</p>
            <ul className="reception-promo-features mt-4 text-sm">
              <li>{t('features.qr')}</li>
              <li>{t('features.fast')}</li>
            </ul>
          </div>
          <div className="shrink-0">
            <a
              href={downloadUrl}
              className="button button-gold inline-flex px-5 py-3 text-sm"
              download={mobileAthleteRelease.fileName}
              rel="noopener noreferrer"
            >
              {downloadLabel}
            </a>
            <p className="muted mt-2 text-center text-xs lg:text-right">{metaLabel}</p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'duo') {
    return (
      <div className="app-duo-card card flex h-full flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.12)] text-[#7dd3fc]">
            {t('badge')}
          </span>
          <span className="muted text-xs">v{version}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-2 text-sm leading-6">{t('checkInHint')}</p>
        <ul className="reception-promo-features mt-4 text-sm">
          <li>{t('features.qr')}</li>
          <li>{t('features.fast')}</li>
        </ul>
        <a
          href={downloadUrl}
          className="button button-gold app-duo-download mt-auto self-start px-5 py-3 text-sm"
          download={mobileAthleteRelease.fileName}
          rel="noopener noreferrer"
        >
          {downloadLabel}
        </a>
        <p className="muted mt-2 text-xs">{metaLabel}</p>
        <p className="muted mt-1 text-xs">{t('unsignedNotice')}</p>
      </div>
    );
  }

  return (
    <div className="reception-promo-compact mt-6 rounded-xl border border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.06)] p-5">
      <p className="text-sm font-medium text-[#7dd3fc]">{t('loginHint')}</p>
      <p className="muted mt-2 text-sm leading-6">{t('loginHintText')}</p>
      <a
        href={downloadUrl}
        className="button-outline-gold mt-4 inline-flex px-4 py-2 text-sm"
        download={mobileAthleteRelease.fileName}
        rel="noopener noreferrer"
      >
        {downloadLabel}
      </a>
      <p className="muted mt-2 text-xs">{metaLabel}</p>
    </div>
  );
}
