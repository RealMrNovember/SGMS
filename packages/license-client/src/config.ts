import type { LicenseClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://license.cicibyte.com/api/v1/license';

export function resolveLicenseClientConfig(
  partial: LicenseClientConfig,
): Required<Pick<LicenseClientConfig, 'baseUrl' | 'appCode' | 'timeoutMs'>> &
  Pick<LicenseClientConfig, 'apiKey'> {
  const rawBase =
    partial.baseUrl ?? process.env.LICENSE_API_BASE_URL ?? DEFAULT_BASE_URL;
  const baseUrl = normalizeLicenseBaseUrl(rawBase);

  return {
    baseUrl,
    appCode: partial.appCode ?? process.env.LICENSE_APP_CODE ?? 'sgms',
    apiKey: partial.apiKey ?? process.env.LICENSE_API_KEY,
    timeoutMs: partial.timeoutMs ?? Number(process.env.LICENSE_API_TIMEOUT_MS ?? 15_000),
  };
}

/** Eski `https://license.cicibyte.com` veya tam `/api/v1/license` girdilerini normalize eder. */
export function normalizeLicenseBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1/license')) {
    return trimmed;
  }
  if (trimmed.endsWith('/api/v1')) {
    return `${trimmed}/license`;
  }
  if (trimmed.endsWith('/api')) {
    return `${trimmed}/v1/license`;
  }
  return `${trimmed}/api/v1/license`;
}

export type LicenseEndpoint = 'trial' | 'check' | 'activate';

export function licenseApiUrl(baseUrl: string, endpoint: LicenseEndpoint | string): string {
  const root = baseUrl.replace(/\/$/, '');
  const path = endpoint.replace(/^\/+/, '').replace(/^v1\/license\//, '');
  return `${root}/${path}`;
}

/** POST isteklerinde 301/302 redirect sonrası GET'e düşmeyi önler. */
export async function postJsonPreserveMethod(
  url: string,
  init: { headers: Record<string, string>; body: string; signal?: AbortSignal },
): Promise<Response> {
  let currentUrl = url;

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(currentUrl, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
      signal: init.signal,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new Error('Lisans API: çok fazla yönlendirme.');
}
