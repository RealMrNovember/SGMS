import { SGMS_API_BASE_URL } from './constants';
import type {
  AthleteSession,
  CheckInQrData,
  DirectMessage,
  HealthMeasurement,
  MeasurementPhoto,
  MeResponse,
  MemberStatement,
  MembershipRenewalResponse,
  TrainerProfile,
  TrainerRequest,
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

export type AddMeasurementInput = {
  weight?: number;
  bodyFatPercentage?: number;
  muscleMass?: number;
  height?: number;
  waistCm?: number;
  chestCm?: number;
  hipCm?: number;
  armCm?: number;
  thighCm?: number;
  bodyWaterPercentage?: number;
  visceralFatRating?: number;
  restingHeartRate?: number;
  notes?: string;
  measuredAt?: string;
};

export async function addMeasurement(
  accessToken: string,
  input: AddMeasurementInput,
): Promise<{ measurement: HealthMeasurement }> {
  return apiFetch('/api/v1/measurements', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export async function fetchMeasurementPhotos(
  accessToken: string,
): Promise<{ photos: MeasurementPhoto[]; count: number }> {
  return apiFetch('/api/v1/measurements/photos', { headers: authHeaders(accessToken) });
}

export async function uploadMeasurementPhoto(
  accessToken: string,
  formData: FormData,
): Promise<{ photo: MeasurementPhoto }> {
  const res = await fetch(`${SGMS_API_BASE_URL}/api/v1/measurements/photos`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: formData,
  });
  const json = (await res.json()) as { ok: boolean; data?: { photo: MeasurementPhoto }; error?: string };
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error ?? 'Fotoğraf yüklenemedi');
  }
  return json.data;
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

export async function startMembershipRenewal(accessToken: string): Promise<MembershipRenewalResponse> {
  return apiFetch('/api/v1/me/membership/renew', {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export async function updateProfile(
  accessToken: string,
  input: { name?: string; phone?: string; email?: string; birthDate?: string },
): Promise<{ message: string }> {
  return apiFetch('/api/v1/me/profile', {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export async function changePassword(
  accessToken: string,
  input: { currentPassword: string; newPassword: string; newPasswordConfirmation: string },
): Promise<{ message: string }> {
  return apiFetch('/api/v1/me/password', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export async function fetchTrainerProfiles(
  accessToken: string,
): Promise<{ trainers: TrainerProfile[]; count: number }> {
  return apiFetch('/api/v1/trainers', { headers: authHeaders(accessToken) });
}

export async function fetchTrainerRequests(
  accessToken: string,
): Promise<{ requests: TrainerRequest[]; count: number }> {
  return apiFetch('/api/v1/trainer-requests', { headers: authHeaders(accessToken) });
}

export async function createTrainerRequest(
  accessToken: string,
  input: {
    requestType: 'ASSIGN' | 'CHANGE' | 'REMOVE';
    preferredTrainerId?: string;
    reason?: string;
  },
): Promise<{ message?: string; request: TrainerRequest | null }> {
  return apiFetch('/api/v1/trainer-requests', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
}

export async function cancelTrainerRequest(
  accessToken: string,
  requestId: string,
): Promise<{ message?: string }> {
  return apiFetch(`/api/v1/trainer-requests/${requestId}/cancel`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}
