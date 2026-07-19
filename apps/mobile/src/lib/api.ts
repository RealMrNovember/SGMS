import { SGMS_API_BASE_URL } from './constants';
import type { AthleteSession, CheckInQrData } from './types';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SGMS_API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error ?? 'Sunucuya bağlanılamadı');
  }
  return json.data;
}

export async function login(email: string, password: string): Promise<AthleteSession> {
  return apiFetch<AthleteSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, scope: 'athlete' }),
  });
}

export async function fetchCheckInQr(accessToken: string): Promise<CheckInQrData> {
  return apiFetch<CheckInQrData>('/api/v1/check-in/qr', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function logout(accessToken: string): Promise<void> {
  await fetch(`${SGMS_API_BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}
