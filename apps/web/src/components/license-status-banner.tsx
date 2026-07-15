import type { CentralLicenseStatus } from '@sgms/database';
import { intlLocaleFor } from '@/lib/format-locale';
import { getLocale, getTranslations } from 'next-intl/server';

export async function LicenseStatusBanner({
  status,
  licenseExpiresAt,
  organizationStatus,
  lastLicenseCheckAt,
}: {
  status: CentralLicenseStatus;
  licenseExpiresAt: Date | null;
  organizationStatus: string;
  lastLicenseCheckAt: Date | null;
}) {
  const t = await getTranslations('license');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const isBlocked =
    organizationStatus === 'SUSPENDED' || status === 'EXPIRED' || status === 'REVOKED';

  const isTrial = status === 'TRIAL';
  const expiresLabel = licenseExpiresAt
    ? licenseExpiresAt.toLocaleDateString(dateLocale)
    : null;

  if (!isBlocked && !isTrial) {
    return null;
  }

  if (isBlocked) {
    return (
      <div className="border-b border-rose-500/40 bg-rose-500/15 px-6 py-3 text-sm text-rose-100">
        {expiresLabel
          ? t('banner.blockedWithDate', { date: expiresLabel })
          : t('banner.blocked')}{' '}
        <a href="/dashboard/billing" className="ml-1 underline">
          {t('banner.billingLink')}
        </a>
        {lastLicenseCheckAt ? (
          <span className="ml-2 opacity-80">
            {t('banner.lastCheck', {
              date: lastLicenseCheckAt.toLocaleString(dateLocale),
            })}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-6 py-3 text-sm text-amber-100">
      {expiresLabel ? t('banner.trialWithDate', { date: expiresLabel }) : t('banner.trial')}{' '}
      <a href="/dashboard/billing" className="ml-1 underline">
        {t('banner.billingLink')}
      </a>
    </div>
  );
}
