import type { CentralLicenseStatus } from '@sgms/database';

export function LicenseStatusBanner({
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
  const isBlocked =
    organizationStatus === 'SUSPENDED' || status === 'EXPIRED' || status === 'REVOKED';

  const isTrial = status === 'TRIAL';
  const expiresLabel = licenseExpiresAt
    ? licenseExpiresAt.toLocaleDateString('tr-TR')
    : null;

  if (!isBlocked && !isTrial) {
    return null;
  }

  if (isBlocked) {
    return (
      <div className="border-b border-rose-500/40 bg-rose-500/15 px-6 py-3 text-sm text-rose-100">
        Merkezi lisans geçersiz veya süresi doldu
        {expiresLabel ? ` (${expiresLabel})` : ''}. Panel salt okunur modda; yeni kayıt ve
        güncelleme yapılamaz.
        {lastLicenseCheckAt ? (
          <span className="ml-2 opacity-80">
            Son kontrol: {lastLicenseCheckAt.toLocaleString('tr-TR')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-6 py-3 text-sm text-amber-100">
      Deneme lisansı aktif
      {expiresLabel ? ` — bitiş: ${expiresLabel}` : ''}. Süre dolmadan üretim lisansı tanımlayın.
    </div>
  );
}
