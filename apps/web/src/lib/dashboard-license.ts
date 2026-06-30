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
  };
}
