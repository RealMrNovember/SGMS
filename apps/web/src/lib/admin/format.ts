import type {
  CentralLicenseStatus,
  OrganizationStatus,
  SubscriptionStatus,
} from '@sgms/database';

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatSubscriptionKind(status: SubscriptionStatus | null | undefined): string {
  switch (status) {
    case 'TRIALING':
      return 'Deneme';
    case 'ACTIVE':
      return 'Ücretli';
    case 'PAST_DUE':
      return 'Gecikmiş ödeme';
    case 'CANCELED':
      return 'İptal';
    case 'EXPIRED':
      return 'Süresi dolmuş';
    default:
      return '—';
  }
}

export function subscriptionTone(
  status: SubscriptionStatus | null | undefined,
): 'gold' | 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'TRIALING':
      return 'gold';
    case 'ACTIVE':
      return 'success';
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'muted';
  }
}

export function licenseTone(
  status: CentralLicenseStatus,
): 'gold' | 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'TRIAL':
      return 'gold';
    case 'ACTIVE':
      return 'success';
    case 'EXPIRED':
    case 'REVOKED':
      return 'danger';
    case 'UNKNOWN':
      return 'warning';
    default:
      return 'muted';
  }
}

export function organizationTone(
  status: OrganizationStatus,
): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'SUSPENDED':
    case 'ARCHIVED':
      return 'danger';
    default:
      return 'muted';
  }
}

export function formatDateTr(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeTr(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
