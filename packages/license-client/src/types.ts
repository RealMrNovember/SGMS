export type LicenseClientConfig = {
  /** Merkezi lisans API taban URL — varsayılan: https://license.cicibyte.com */
  baseUrl?: string;
  /** Uygulama kodu — license.cicibyte.com Application.app_code */
  appCode: string;
  /** X-Api-Key (LICENSE_API_KEY) — üretimde zorunlu */
  apiKey?: string;
  /** İstek zaman aşımı (ms) */
  timeoutMs?: number;
};

export type LicenseApiPayload = {
  status: string;
  type: string;
  expires_at: string | null;
  hwid: string;
  max_devices: number;
  registered_devices: number;
};

export type LicenseApiResponse = {
  success: boolean;
  data?: LicenseApiPayload;
  message?: string;
};

export type LicenseCheckResult = {
  ok: boolean;
  statusCode: number;
  message: string;
  payload?: LicenseApiPayload;
  licenseKey?: string;
};

export type EnsureLicenseInput = {
  installationId: string;
  licenseKey?: string | null;
};

export type EnsureLicenseResult = {
  ok: boolean;
  status: 'trial_started' | 'activated' | 'validated' | 'expired' | 'error';
  message: string;
  payload?: LicenseApiPayload;
  licenseKey?: string;
};
