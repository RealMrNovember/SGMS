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
};

export type TenantSyncPayload = {
  license_key: string;
  status: string;
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
