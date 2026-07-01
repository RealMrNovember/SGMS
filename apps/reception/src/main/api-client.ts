import type { ReceptionConfig } from '../shared/types';

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export async function apiRequest<T = unknown>(
  config: ReceptionConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const url = `${config.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as { ok?: boolean; data?: T; error?: string };
    return {
      ok: Boolean(json.ok) && res.ok,
      status: res.status,
      data: json.data,
      error: json.error,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Ağ hatası',
    };
  }
}
