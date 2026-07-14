export type CloudClientConfig = {
  /** CiciByte Cloud API taban URL — varsayılan: https://cloud.cicibyte.com/api */
  baseUrl?: string;
  /** Developer → API Keys altında bu ürün için üretilen anahtar (X-Api-Key) */
  apiKey?: string;
  /** cloud.cicibyte.com'daki Product.slug — SGMS için sabit 'sgms' */
  productSlug?: string;
  /** İstek zaman aşımı (ms) */
  timeoutMs?: number;
};

export type CloudTenantStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export type TenantSyncInput = {
  tenantSlug: string;
  tenantName: string;
  email?: string | null;
  planCode?: string | null;
  status: CloudTenantStatus;
  trialEndsAt?: string | null;
  seats?: number | null;
  /** "Sizi kim yönlendirdi?" serbest metni — cloud.cicibyte.com'da bir Partner ile eşleşirse
   * komisyon takibi için otomatik atanır, eşleşmezse not olarak bırakılır. */
  referrerName?: string | null;
};

export type TenantSyncPayload = {
  license_key: string;
  status: string;
};

// --- Mail relay (v2) ---

export type MailCategory = 'transactional' | 'password_reset' | 'reminder' | 'notification';

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  category?: MailCategory;
};

export type SendMailPayload = {
  id: number;
  status: string;
};

// --- Commerce checkout (v2) — tüm CiciByte ürünleri ödeme işlemlerini buradan geçirir ---

export type CommerceBuyer = {
  name?: string;
  surname?: string;
  gsmNumber?: string;
  identityNumber?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
};

export type StartCheckoutInput = {
  tenantSlug: string;
  tenantName: string;
  email?: string | null;
  planCode?: string | null;
  billingInterval?: 'monthly' | 'yearly';
  amount: number;
  currency?: string;
  provider?: 'iyzico';
  buyer?: CommerceBuyer;
  /** Ödeme sonrası cloud.cicibyte.com'un tarayıcıyı yönlendireceği sayfa (query'e payment_id ve status eklenir). */
  returnUrl: string;
};

export type CheckoutPayload = {
  payment_id: number;
  checkout_url: string | null;
  status: string;
};

export type PaymentStatusPayload = {
  payment_id: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  amount: string;
  currency: string;
  paid_at: string | null;
};

export type CloudApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type CloudApiResult<T> = {
  ok: boolean;
  statusCode: number;
  message: string;
  payload?: T;
};

export type CloudHealthCheck = {
  status: 'healthy' | 'degraded' | 'down';
  message: string;
};

export type CloudHealthResult = {
  ok: boolean;
  checks: Record<string, CloudHealthCheck>;
  time: string;
};

// --- Legacy hwid tabanlı lisans yüzeyi (v1) — masaüstü/offline cihazlar için saklanıyor ---

export type LicenseDevice = {
  hwid: string;
  last_seen_at: string | null;
  is_blocked: boolean;
  is_current: boolean;
};

export type LicenseApiPayload = {
  status: string;
  type: string;
  expires_at: string | null;
  hwid: string | null;
  max_devices: number;
  registered_devices: number;
  firm_email?: string | null;
  devices?: LicenseDevice[];
  plan?: string | null;
  feature_flags?: string[];
};

export type OfflineTokenPayload = {
  token: string;
  issued_at: string;
  expires_at: string;
  public_key: string;
};
