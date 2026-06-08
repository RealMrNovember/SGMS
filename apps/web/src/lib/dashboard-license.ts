import type { CentralLicenseStatus } from '@sgms/database';

export type DashboardLicenseSummary = {
  status: CentralLicenseStatus;
  type: string | null;
  expiresAt: Date | null;
  lastCheckAt: Date | null;
  trialStartedAt: Date | null;
  installationId: string;
  daysRemaining: number | null;
  isOperational: boolean;
  statusLabel: string;
};

const STATUS_LABELS: Record<CentralLicenseStatus, string> = {
  UNKNOWN: 'Bilinmiyor',
  TRIAL: 'Deneme',
  ACTIVE: 'Aktif',
  EXPIRED: 'Süresi doldu',
  REVOKED: 'İptal edildi',
};

export function computeDaysRemaining(expiresAt: Date | null): number | null {
  if (!expiresAt) {
    return null;
  }
  const diff = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isCentralLicenseOperational(
  status: CentralLicenseStatus,
  expiresAt: Date | null,
): boolean {
  if (status === 'EXPIRED' || status === 'REVOKED') {
    return false;
  }
  if (status === 'UNKNOWN') {
    return true;
  }
  const days = computeDaysRemaining(expiresAt);
  if (days != null && days <= 0) {
    return false;
  }
  return status === 'TRIAL' || status === 'ACTIVE';
}

export function buildDashboardLicenseSummary(input: {
  centralLicenseStatus: CentralLicenseStatus;
  centralLicenseType: string | null;
  licenseExpiresAt: Date | null;
  lastLicenseCheckAt: Date | null;
  trialStartedAt: Date | null;
  installationId: string;
}): DashboardLicenseSummary {
  const daysRemaining = computeDaysRemaining(input.licenseExpiresAt);
  const isOperational = isCentralLicenseOperational(
    input.centralLicenseStatus,
    input.licenseExpiresAt,
  );

  return {
    status: input.centralLicenseStatus,
    type: input.centralLicenseType,
    expiresAt: input.licenseExpiresAt,
    lastCheckAt: input.lastLicenseCheckAt,
    trialStartedAt: input.trialStartedAt,
    installationId: input.installationId,
    daysRemaining,
    isOperational,
    statusLabel: STATUS_LABELS[input.centralLicenseStatus],
  };
}

export function licenseCardHint(
  role: string | null | undefined,
  summary: DashboardLicenseSummary,
): string {
  if (role === 'OWNER' || role === 'ADMIN') {
    if (!summary.isOperational) {
      return 'Merkezi lisans geçersiz — yazma işlemleri kısıtlı.';
    }
    if (summary.status === 'TRIAL' && summary.daysRemaining != null) {
      return `Deneme süresi: ${summary.daysRemaining} gün kaldı.`;
    }
    return 'Merkezi lisans sunucusu ile senkron.';
  }

  if (!summary.isOperational) {
    return 'Salon lisansı geçersiz — yöneticinize başvurun.';
  }

  return summary.status === 'TRIAL' ? 'Salon deneme lisansında.' : 'Salon lisansı aktif.';
}
