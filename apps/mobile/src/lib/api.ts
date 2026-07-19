import { SGMS_API_BASE_URL } from './constants';
import type {
  AthleteSession,
  CheckInQrData,
  DirectMessage,
  HealthMeasurement,
  MeResponse,
  MemberStatement,
  TrainingProgram,
} from './types';

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

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function login(email: string, password: string): Promise<AthleteSession> {
  return apiFetch<AthleteSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, scope: 'athlete' }),
  });
}

export async function logout(accessToken: string): Promise<void> {
  await fetch(`${SGMS_API_BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  }).catch(() => undefined);
}

export async function fetchCheckInQr(accessToken: string): Promise<CheckInQrData> {
  return apiFetch<CheckInQrData>('/api/v1/check-in/qr', { headers: authHeaders(accessToken) });
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/v1/me', { headers: authHeaders(accessToken) });
}

export async function fetchPrograms(accessToken: string): Promise<{ programs: TrainingProgram[] }> {
  return apiFetch('/api/v1/programs', { headers: authHeaders(accessToken) });
}

export async function fetchMeasurements(
  accessToken: string,
): Promise<{ measurements: HealthMeasurement[] }> {
  return apiFetch('/api/v1/measurements', { headers: authHeaders(accessToken) });
}

export async function addMeasurement(
  accessToken: string,
  input: { weight?: number; bodyFatPercentage?: number; muscleMass?: number; notes?: string },
): Promise<{ measurement: HealthMeasurement }> {
  return apiFetch('/api/v1/measurements', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export async function fetchMessages(
  accessToken: string,
  box: 'inbox' | 'sent',
): Promise<{ messages: DirectMessage[] }> {
  return apiFetch(`/api/v1/messages?box=${box}`, { headers: authHeaders(accessToken) });
}

export async function sendMessage(
  accessToken: string,
  receiverId: string,
  content: string,
): Promise<{ message: DirectMessage }> {
  return apiFetch('/api/v1/messages', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ receiverId, content }),
  });
}

export async function fetchStatement(accessToken: string): Promise<MemberStatement> {
  return apiFetch('/api/v1/me/statement', { headers: authHeaders(accessToken) });
}
