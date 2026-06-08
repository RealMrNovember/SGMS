import type { LicenseClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://license.cicibyte.com';

export function resolveLicenseClientConfig(
  partial: LicenseClientConfig,
): Required<Pick<LicenseClientConfig, 'baseUrl' | 'appCode' | 'timeoutMs'>> &
  Pick<LicenseClientConfig, 'apiKey'> {
  return {
    baseUrl: (partial.baseUrl ?? process.env.LICENSE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    appCode: partial.appCode ?? process.env.LICENSE_APP_CODE ?? 'sgms',
    apiKey: partial.apiKey ?? process.env.LICENSE_API_KEY,
    timeoutMs: partial.timeoutMs ?? Number(process.env.LICENSE_API_TIMEOUT_MS ?? 15_000),
  };
}

export function licenseApiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api${normalizedPath}`;
}
