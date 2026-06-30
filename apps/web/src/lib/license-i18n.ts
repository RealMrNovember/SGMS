import type { CentralLicenseStatus } from '@sgms/database';
import type { DashboardLicenseSummary } from '@/lib/dashboard-license';

const STATUS_KEYS: Record<CentralLicenseStatus, string> = {
  UNKNOWN: 'unknown',
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

export function licenseStatusKey(status: CentralLicenseStatus): string {
  return `status.${STATUS_KEYS[status]}`;
}

export function resolveLicenseCardHint(
  role: string | null | undefined,
  summary: DashboardLicenseSummary,
): { key: string; values?: Record<string, string | number> } {
  if (role === 'OWNER' || role === 'ADMIN') {
    if (!summary.isOperational) {
      return { key: 'hint.adminBlocked' };
    }
    if (summary.status === 'TRIAL' && summary.daysRemaining != null) {
      return { key: 'hint.adminTrial', values: { days: summary.daysRemaining } };
    }
    return { key: 'hint.adminSynced' };
  }

  if (!summary.isOperational) {
    return { key: 'hint.staffBlocked' };
  }

  return summary.status === 'TRIAL' ? { key: 'hint.staffTrial' } : { key: 'hint.staffActive' };
}
