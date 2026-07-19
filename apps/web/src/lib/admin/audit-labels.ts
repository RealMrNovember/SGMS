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
  | 'content'
  | 'membership'
  | 'classes'
  | 'checkin'
  | 'auth'
  | 'security'
  | 'settings'
  | 'partner'
  | 'trainer'
  | 'enterprise'
  | 'leads'
  | 'compliance'
  | 'hr'
  | 'equipment';

export const AUDIT_CATEGORY_ACTIONS: Record<Exclude<AuditCategory, 'all'>, AuditAction[]> = {
  organization: ['ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED', 'ORGANIZATION_DELETED'],
  subscription: [
    'SUBSCRIPTION_STARTED',
    'SUBSCRIPTION_CHANGED',
    'SUBSCRIPTION_CANCELED',
    'CLOUD_PAYMENT_SUCCEEDED',
    'CLOUD_PAYMENT_FAILED',
  ],
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
  members: ['MEMBER_REGISTERED', 'MEASUREMENT_ADDED', 'MEMBERSHIP_REMINDER_SENT', 'HEALTH_CONSENT_RECORDED'],
  devices: ['DEVICE_REGISTERED', 'DEVICE_UPDATED', 'DEVICE_DISABLED'],
  finance: [
    'EXPENSE_ADDED',
    'EXPENSE_VOIDED',
    'PAYMENT_RECORDED',
    'REFUND_RECORDED',
    'PAYMENT_PLAN_CREATED',
    'PAYMENT_PLAN_CANCELLED',
    'PROFORMA_SENT',
    'INVOICE_ISSUED',
    'CASH_SHIFT_OPENED',
    'CASH_SHIFT_CLOSED',
    'CASH_X_REPORT',
  ],
  content: ['HELP_ARTICLE_CREATED', 'HELP_ARTICLE_UPDATED', 'HELP_ARTICLE_DELETED'],
  membership: [
    'MEMBERSHIP_FREEZE_REQUESTED',
    'MEMBERSHIP_FREEZE_APPROVED',
    'MEMBERSHIP_FREEZE_REJECTED',
    'MEMBERSHIP_TRANSFER_COMPLETED',
    'MEMBERSHIP_RIGHTS_CREDITED',
    'MEMBERSHIP_GROUP_CREATED',
    'MEMBERSHIP_GROUP_UPDATED',
    'MEMBERSHIP_REMINDER_SENT',
  ],
  classes: [
    'CLASS_CREATED',
    'CLASS_SESSION_UPDATED',
    'CLASS_BOOKING_CREATED',
    'CLASS_BOOKING_CANCELLED',
    'CLASS_ATTENDANCE_MARKED',
    'DISCOUNT_CODE_CREATED',
    'DISCOUNT_CODE_REDEEMED',
    'GUEST_PASS_ISSUED',
    'GUEST_PASS_REVOKED',
  ],
  checkin: ['MEMBER_CHECK_IN'],
  auth: ['USER_LOGIN', 'USER_LOGOUT'],
  security: [
    'USER_LOGIN_FAILED',
    'ACCESS_DENIED',
    'API_ERROR',
    'AUDIT_LOG_DELETED',
    'MESSAGE_REPORTED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'TWO_FACTOR_ENABLED',
    'TWO_FACTOR_DISABLED',
    'TWO_FACTOR_BACKUP_CODES_REGENERATED',
    'STAFF_INVITE_SENT',
    'STAFF_INVITE_ACCEPTED',
  ],
  settings: [
    'SETTINGS_CHANGED',
    'PLATFORM_PAYMENT_SETTINGS_CHANGED',
    'CONTRACT_TEMPLATE_UPDATED',
    'TENANT_PAYMENT_GATEWAY_CONFIGURED',
  ],
  partner: [
    'PARTNER_CREATED',
    'PARTNER_UPDATED',
    'PARTNER_ASSIGNED',
    'PARTNER_UNASSIGNED',
    'PARTNER_DISCOUNT_UPDATED',
    'PARTNER_CAPACITY_ADJUSTED',
    'PARTNER_TRIAL_EXTENDED',
    'PUSH_SUBSCRIBED',
    'PUSH_UNSUBSCRIBED',
  ],
  trainer: [
    'TRAINER_PROFILE_UPDATED',
    'PT_SESSION_SCHEDULED',
    'PT_SESSION_COMPLETED',
    'PT_SESSION_CANCELED',
  ],
  enterprise: [
    'ORGANIZATION_HIERARCHY_LINKED',
    'ORGANIZATION_HIERARCHY_UNLINKED',
    'HIERARCHY_MEMBER_GRANTED',
    'HIERARCHY_MEMBER_REVOKED',
  ],
  leads: [
    'LEAD_CREATED',
    'LEAD_STATUS_CHANGED',
    'LEAD_CONVERTED',
    'LEAD_FOLLOW_UP_SCHEDULED',
    'LEAD_FOLLOW_UP_COMPLETED',
  ],
  compliance: [
    'DATA_EXPORT_REQUESTED',
    'ACCOUNT_DELETION_REQUESTED',
    'HEALTH_CONSENT_RECORDED',
    'CONTRACT_TEMPLATE_UPDATED',
    'CONTRACT_PDF_GENERATED',
    'INVOICE_ISSUED',
  ],
  hr: [
    'LEAVE_REQUESTED',
    'LEAVE_APPROVED',
    'LEAVE_REJECTED',
    'SHIFT_CREATED',
    'SHIFT_ASSIGNED',
    'PERFORMANCE_REVIEW_CREATED',
    'DISCIPLINARY_RECORD_CREATED',
    'STAFF_COMPENSATION_UPDATED',
  ],
  equipment: [
    'EQUIPMENT_CREATED',
    'EQUIPMENT_UPDATED',
    'EQUIPMENT_ISSUE_REPORTED',
    'EQUIPMENT_SERVICE_LOGGED',
    'MAINTENANCE_SCHEDULE_UPDATED',
  ],
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  ORGANIZATION_CREATED: 'Salon oluşturuldu',
  ORGANIZATION_UPDATED: 'Salon güncellendi',
  ORGANIZATION_DELETED: 'Salon kalıcı olarak silindi',
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
  PASSWORD_RESET_REQUESTED: 'Şifre sıfırlama talebi',
  PASSWORD_RESET_COMPLETED: 'Şifre sıfırlama tamamlandı',
  CLOUD_PAYMENT_SUCCEEDED: 'Ödeme başarılı (cloud.cicibyte.com)',
  CLOUD_PAYMENT_FAILED: 'Ödeme başarısız (cloud.cicibyte.com)',
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
  REFUND_RECORDED: 'İade kaydedildi',
  SETTINGS_CHANGED: 'Ayar değişikliği',
  AUDIT_LOG_DELETED: 'Denetim kaydı silindi',
  MESSAGE_REPORTED: 'Mesaj şikayeti',
  PARTNER_CREATED: 'Temsilci oluşturuldu',
  PARTNER_UPDATED: 'Temsilci güncellendi',
  PARTNER_ASSIGNED: 'Temsilci salona atandı',
  PARTNER_UNASSIGNED: 'Temsilci ataması kaldırıldı',
  PARTNER_DISCOUNT_UPDATED: 'Temsilci indirimi güncellendi',
  PARTNER_CAPACITY_ADJUSTED: 'Temsilci ek kapasite tanımladı',
  PARTNER_TRIAL_EXTENDED: 'Temsilci deneme süresini uzattı',
  PUSH_SUBSCRIBED: 'Tarayıcı bildirimi etkinleştirildi',
  PUSH_UNSUBSCRIBED: 'Tarayıcı bildirimi kapatıldı',
  TRAINER_PROFILE_UPDATED: 'PT komisyon modeli güncellendi',
  PT_SESSION_SCHEDULED: 'PT seansı planlandı',
  PT_SESSION_COMPLETED: 'PT seansı tamamlandı',
  PT_SESSION_CANCELED: 'PT seansı iptal/no-show',
  ORGANIZATION_HIERARCHY_LINKED: 'Organizasyon kurumsal hiyerarşiye bağlandı',
  ORGANIZATION_HIERARCHY_UNLINKED: 'Organizasyonun kurumsal hiyerarşi bağı kaldırıldı',
  HIERARCHY_MEMBER_GRANTED: 'Kurumsal hiyerarşi yetkisi verildi',
  HIERARCHY_MEMBER_REVOKED: 'Kurumsal hiyerarşi yetkisi kaldırıldı',
  PAYMENT_PLAN_CREATED: 'Ödeme planı oluşturuldu',
  PAYMENT_PLAN_CANCELLED: 'Ödeme planı iptal edildi',
  PLATFORM_PAYMENT_SETTINGS_CHANGED: 'Platform ödeme ayarları değiştirildi',
  TWO_FACTOR_ENABLED: '2FA etkinleştirildi',
  TWO_FACTOR_DISABLED: '2FA devre dışı bırakıldı',
  TWO_FACTOR_BACKUP_CODES_REGENERATED: '2FA yedek kodları yenilendi',
  STAFF_INVITE_SENT: 'Personel daveti gönderildi',
  STAFF_INVITE_ACCEPTED: 'Personel daveti kabul edildi',
  PROFORMA_SENT: 'Proforma fatura gönderildi',
  HELP_ARTICLE_CREATED: 'Kılavuz makalesi oluşturuldu',
  HELP_ARTICLE_UPDATED: 'Kılavuz makalesi güncellendi',
  HELP_ARTICLE_DELETED: 'Kılavuz makalesi silindi',
  MEMBERSHIP_REMINDER_SENT: 'Üyelik hatırlatması gönderildi',
  LEAD_CREATED: 'Aday eklendi',
  LEAD_STATUS_CHANGED: 'Aday durumu değişti',
  LEAD_CONVERTED: 'Aday üyeye dönüştürüldü',
  LEAD_FOLLOW_UP_SCHEDULED: 'Aday takibi planlandı',
  LEAD_FOLLOW_UP_COMPLETED: 'Aday takibi tamamlandı',
  MEMBERSHIP_FREEZE_REQUESTED: 'Üyelik dondurma talebi',
  MEMBERSHIP_FREEZE_APPROVED: 'Üyelik dondurma onaylandı',
  MEMBERSHIP_FREEZE_REJECTED: 'Üyelik dondurma reddedildi',
  MEMBERSHIP_TRANSFER_COMPLETED: 'Üyelik devri tamamlandı',
  MEMBERSHIP_RIGHTS_CREDITED: 'Kalan üyelik hakkı kredilendi',
  MEMBERSHIP_GROUP_CREATED: 'Üyelik grubu oluşturuldu',
  MEMBERSHIP_GROUP_UPDATED: 'Üyelik grubu güncellendi',
  CLASS_CREATED: 'Grup dersi oluşturuldu',
  CLASS_SESSION_UPDATED: 'Ders oturumu güncellendi',
  CLASS_BOOKING_CREATED: 'Ders kaydı oluşturuldu',
  CLASS_BOOKING_CANCELLED: 'Ders kaydı iptal edildi',
  CLASS_ATTENDANCE_MARKED: 'Ders yoklaması alındı',
  DISCOUNT_CODE_CREATED: 'İndirim kodu oluşturuldu',
  DISCOUNT_CODE_REDEEMED: 'İndirim kodu kullanıldı',
  GUEST_PASS_ISSUED: 'Misafir geçiş izni verildi',
  GUEST_PASS_REVOKED: 'Misafir geçiş izni iptal edildi',
  DATA_EXPORT_REQUESTED: 'KVKK veri dışa aktarımı',
  ACCOUNT_DELETION_REQUESTED: 'Hesap silme talebi',
  HEALTH_CONSENT_RECORDED: 'Sağlık/rıza onayı kaydedildi',
  CONTRACT_TEMPLATE_UPDATED: 'Sözleşme şablonu güncellendi',
  CONTRACT_PDF_GENERATED: 'Üyelik sözleşmesi PDF üretildi',
  INVOICE_ISSUED: 'Fatura düzenlendi',
  LEAVE_REQUESTED: 'İzin talebi oluşturuldu',
  LEAVE_APPROVED: 'İzin onaylandı',
  LEAVE_REJECTED: 'İzin reddedildi',
  SHIFT_CREATED: 'Vardiya şablonu oluşturuldu',
  SHIFT_ASSIGNED: 'Vardiya atandı',
  PERFORMANCE_REVIEW_CREATED: 'Performans değerlendirmesi',
  DISCIPLINARY_RECORD_CREATED: 'Disiplin kaydı',
  STAFF_COMPENSATION_UPDATED: 'Personel maaş/prim güncellendi',
  EQUIPMENT_CREATED: 'Ekipman eklendi',
  EQUIPMENT_UPDATED: 'Ekipman güncellendi',
  EQUIPMENT_ISSUE_REPORTED: 'Ekipman arızası bildirildi',
  EQUIPMENT_SERVICE_LOGGED: 'Ekipman servis kaydı',
  MAINTENANCE_SCHEDULE_UPDATED: 'Bakım planı güncellendi',
  CASH_SHIFT_OPENED: 'Kasa vardiyası açıldı',
  CASH_SHIFT_CLOSED: 'Kasa vardiyası kapandı',
  CASH_X_REPORT: 'Kasa X raporu',
  TENANT_PAYMENT_GATEWAY_CONFIGURED: 'Salon ödeme sağlayıcı ayarları değiştirildi',
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
  content: 'İçerik / Kılavuz',
  membership: 'Üyelik yaşam döngüsü',
  classes: 'Ders / Kupon / Misafir',
  checkin: 'Turnike',
  auth: 'Oturum',
  security: 'Güvenlik',
  settings: 'Ayarlar',
  partner: 'Temsilci',
  trainer: 'PT Performansı',
  enterprise: 'Kurumsal Hiyerarşi',
  leads: 'Aday Takibi',
  compliance: 'Uyumluluk / KVKK',
  hr: 'Personel / HR',
  equipment: 'Ekipman',
};

export const LOGIN_FAILURE_LABELS: Record<string, string> = {
  invalid_credentials_format: 'Geçersiz e-posta veya parola formatı',
  user_not_found: 'Kullanıcı bulunamadı',
  user_inactive: 'Hesap pasif / devre dışı',
  invalid_password: 'Hatalı parola',
  no_api_scope: 'API erişim kapsamı yok',
  rate_limited: 'Çok fazla deneme — geçici olarak sınırlandı',
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
