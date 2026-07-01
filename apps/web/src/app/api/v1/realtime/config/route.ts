import { apiOk } from '@/lib/api/response';

/** Public Soketi client config for desktop / mobile apps (no secrets). */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_SOKETI_KEY?.trim();

  if (!key) {
    return apiOk({
      enabled: false,
      key: null,
      wsPath: '/realtime/app',
      forceTLS: true,
      wsPort: 443,
      wssPort: 443,
    });
  }

  const forceTLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS !== 'false';

  return apiOk({
    enabled: true,
    key,
    wsPath: process.env.NEXT_PUBLIC_SOKETI_WS_PATH ?? '/realtime/app',
    forceTLS,
    wsPort: Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT ?? (forceTLS ? 443 : 6001)),
    wssPort: Number(process.env.NEXT_PUBLIC_SOKETI_WSS_PORT ?? 443),
  });
}
