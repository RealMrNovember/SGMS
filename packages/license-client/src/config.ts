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
  const { request } = await import('node:https');
  const { request: httpRequest } = await import('node:http');

  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'http:' ? httpRequest : request;

    const req = transport(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          ...init.headers,
          'Content-Length': Buffer.byteLength(init.body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve(
            new Response(text, {
              status: res.statusCode ?? 502,
              headers: res.headers as HeadersInit,
            }),
          );
        });
      },
    );

    req.on('error', reject);

    if (init.signal) {
      init.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    req.write(init.body);
    req.end();
  });
}
