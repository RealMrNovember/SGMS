import type { AuditAction } from '@sgms/database';

export type AuditCategory =
  | 'all'
  | 'organization'
  | 'subscription'
  | 'license'
  | 'team'
  | 'members'
  | 'devices'
  | 'finance'
  | 'checkin'
  | 'auth'
  | 'security'
  | 'settings';

export const AUDIT_CATEGORY_ACTIONS: Record<Exclude<AuditCategory, 'all'>, AuditAction[]> = {
  organization: ['ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED'],
  subscription: ['SUBSCRIPTION_STARTED', 'SUBSCRIPTION_CHANGED', 'SUBSCRIPTION_CANCELED'],
  license: [
    'LICENSE_TRIAL_STARTED',
    'LICENSE_ACTIVATED',
    'LICENSE_VALIDATED',
    'LICENSE_HEARTBEAT',
    'LICENSE_EXPIRED',
    'CLOUD_TENANT_SYNCED',
    'CLOUD_SYNC_FAILED',
  ],
  team: ['MEMBER_INVITED', 'USER_CREATED', 'USER_UPDATED', 'MEMBER_UPDATED', 'MEMBER_REMOVED'],
  members: ['MEMBER_REGISTERED', 'MEASUREMENT_ADDED'],
  devices: ['DEVICE_REGISTERED', 'DEVICE_UPDATED', 'DEVICE_DISABLED'],
  finance: ['EXPENSE_ADDED', 'EXPENSE_VOIDED', 'PAYMENT_RECORDED'],
  checkin: ['MEMBER_CHECK_IN'],
  auth: ['USER_LOGIN', 'USER_LOGOUT'],
  security: ['USER_LOGIN_FAILED', 'ACCESS_DENIED', 'API_ERROR', 'AUDIT_LOG_DELETED', 'MESSAGE_REPORTED'],
  settings: ['SETTINGS_CHANGED'],
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  ORGANIZATION_CREATED: 'Salon oluşturuldu',
  ORGANIZATION_UPDATED: 'Salon güncellendi',
  SUBSCRIPTION_STARTED: 'Abonelik başlatıldı',
  SUBSCRIPTION_CHANGED: 'Abonelik değiştirildi',
  SUBSCRIPTION_CANCELED: 'Abonelik iptal edildi',
  DEVICE_REGISTERED: 'Cihaz kaydedildi',
  DEVICE_UPDATED: 'Cihaz güncellendi',
  DEVICE_DISABLED: 'Cihaz devre dışı',
  LICENSE_TRIAL_STARTED: 'Deneme lisansı başladı',
  LICENSE_ACTIVATED: 'Lisans aktifleştirildi',
  LICENSE_VALIDATED: 'Lisans doğrulandı',
  LICENSE_HEARTBEAT: 'Lisans senkronu',
  LICENSE_EXPIRED: 'Lisans süresi doldu',
  CLOUD_TENANT_SYNCED: 'CiciByte Cloud senkronu',
  CLOUD_SYNC_FAILED: 'CiciByte Cloud senkronu başarısız',
  USER_CREATED: 'Kullanıcı oluşturuldu',
  USER_UPDATED: 'Kullanıcı güncellendi',
  USER_LOGIN: 'Başarılı giriş',
  USER_LOGIN_FAILED: 'Başarısız giriş / parola hatası',
  USER_LOGOUT: 'Çıkış yapıldı',
  ACCESS_DENIED: 'Erişim reddedildi',
  API_ERROR: 'API hatası',
  MEMBER_INVITED: 'Personel davet edildi',
  MEMBER_UPDATED: 'Personel güncellendi',
  MEMBER_REMOVED: 'Personel kaldırıldı / pasif',
  MEMBER_REGISTERED: 'Sporcu kaydedildi',
  MEMBER_CHECK_IN: 'Salon girişi (turnike)',
  MEASUREMENT_ADDED: 'Ölçüm eklendi',
  EXPENSE_ADDED: 'Borç eklendi',
  EXPENSE_VOIDED: 'Borç iptal edildi',
  PAYMENT_RECORDED: 'Tahsilat kaydedildi',
  SETTINGS_CHANGED: 'Ayar değişikliği',
  AUDIT_LOG_DELETED: 'Denetim kaydı silindi',
  MESSAGE_REPORTED: 'Mesaj şikayeti',
};

export const ALL_AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  all: 'Tümü',
  organization: 'Salon',
  subscription: 'Abonelik',
  license: 'Lisans / Cloud',
  team: 'Ekip',
  members: 'Sporcu',
  devices: 'Cihaz',
  finance: 'Finans',
  checkin: 'Turnike',
  auth: 'Oturum',
  security: 'Güvenlik',
  settings: 'Ayarlar',
};

export const LOGIN_FAILURE_LABELS: Record<string, string> = {
  invalid_credentials_format: 'Geçersiz e-posta veya parola formatı',
  user_not_found: 'Kullanıcı bulunamadı',
  user_inactive: 'Hesap pasif / devre dışı',
  invalid_password: 'Hatalı parola',
  no_api_scope: 'API erişim kapsamı yok',
  org_mismatch: 'Organizasyon uyuşmazlığı',
  super_admin_blocked: 'Super admin API girişi engellendi',
};

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditCategoryForAction(action: AuditAction): AuditCategory {
  for (const [category, actions] of Object.entries(AUDIT_CATEGORY_ACTIONS) as [
    Exclude<AuditCategory, 'all'>,
    AuditAction[],
  ][]) {
    if (actions.includes(action)) return category;
  }
  return 'settings';
}

export function auditCategoryTone(
  category: AuditCategory,
  action?: AuditAction,
): 'gold' | 'success' | 'warning' | 'danger' | 'muted' {
  if (action === 'USER_LOGIN_FAILED' || action === 'ACCESS_DENIED' || action === 'API_ERROR') {
    return 'danger';
  }
  if (action === 'AUDIT_LOG_DELETED') {
    return 'warning';
  }
  if (action === 'USER_LOGIN' || action === 'USER_LOGOUT') {
    return 'success';
  }
  switch (category) {
    case 'organization':
    case 'subscription':
      return 'gold';
    case 'license':
      return 'warning';
    case 'finance':
    case 'checkin':
      return 'success';
    case 'security':
      return 'danger';
    case 'devices':
      return 'muted';
    case 'team':
    case 'members':
      return 'success';
    case 'auth':
      return 'success';
    default:
      return 'muted';
  }
}

export function formatAuditMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export function auditSummary(metadata: unknown, action: AuditAction): string {
  if (!metadata || typeof metadata !== 'object') return '—';
  const m = metadata as Record<string, unknown>;

  if (action === 'USER_LOGIN_FAILED' && typeof m.reason === 'string') {
    const email = typeof m.email === 'string' ? m.email : '';
    return `${LOGIN_FAILURE_LABELS[m.reason] ?? m.reason}${email ? ` · ${email}` : ''}`;
  }

  if (typeof m.deletedCount === 'number') return `${m.deletedCount} kayıt silindi`;
  if (typeof m.deletedSummary === 'string') return String(m.deletedSummary);
  if (typeof m.email === 'string') return m.email;
  if (typeof m.reason === 'string') return String(m.reason);
  if (typeof m.status === 'string') return String(m.status);
  if (typeof m.role === 'string') return `Rol: ${m.role}`;

  const keys = Object.keys(m).slice(0, 3);
  if (!keys.length) return '—';
  return keys.map((k) => `${k}: ${String(m[k])}`).join(' · ');
}
