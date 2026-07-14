import type { CloudClientConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://cloud.cicibyte.com/api';

export function resolveCloudClientConfig(
  partial: CloudClientConfig,
): Required<Pick<CloudClientConfig, 'baseUrl' | 'productSlug' | 'timeoutMs'>> &
  Pick<CloudClientConfig, 'apiKey'> {
  const rawBase = partial.baseUrl ?? process.env.CLOUD_API_BASE_URL ?? DEFAULT_BASE_URL;

  return {
    baseUrl: normalizeCloudBaseUrl(rawBase),
    productSlug: partial.productSlug ?? process.env.CLOUD_PRODUCT_SLUG ?? 'sgms',
    apiKey: partial.apiKey ?? process.env.CLOUD_API_KEY,
    timeoutMs: partial.timeoutMs ?? Number(process.env.CLOUD_API_TIMEOUT_MS ?? 15_000),
  };
}

/** `https://cloud.cicibyte.com`, `.../api`, `.../api/` gibi girdileri `https://cloud.cicibyte.com/api` biçimine normalize eder. */
export function normalizeCloudBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function cloudApiUrl(baseUrl: string, path: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/${path.replace(/^\/+/, '')}`;
}

/** POST/PUT isteklerinde 301/302 redirect sonrası GET'e düşmeyi önler. */
export async function requestJsonPreserveMethod(
  method: 'POST' | 'PUT',
  url: string,
  init: { headers: Record<string, string>; body: string; signal?: AbortSignal },
): Promise<Response> {
  let currentUrl = url;

  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(currentUrl, {
      method,
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

  throw new Error('CiciByte Cloud API: çok fazla yönlendirme.');
}
