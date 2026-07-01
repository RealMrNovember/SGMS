import { apiRequest } from './api-client';
import type { CheckInNotificationPayload, ReceptionConfig } from '../shared/types';

type PollHandler = (payload: CheckInNotificationPayload) => void;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let knownIds = new Set<string>();

function mapCheckIn(row: {
  id: string;
  subjectType: string;
  direction: string;
  method: string;
  checkedInAt: string;
  gymMember?: { firstName: string; lastName: string; avatarUrl?: string | null } | null;
  staffUser?: { name: string } | null;
  device?: { name: string } | null;
}): CheckInNotificationPayload {
  const personName = row.gymMember
    ? `${row.gymMember.firstName} ${row.gymMember.lastName}`
    : (row.staffUser?.name ?? '—');

  return {
    id: row.id,
    subjectType: row.subjectType,
    direction: row.direction as 'ENTRY' | 'EXIT',
    personName,
    subtitle: row.subjectType === 'STAFF' ? 'Personel' : 'Üye',
    checkedInAt: row.checkedInAt,
    method: row.method,
    deviceName: row.device?.name ?? null,
    avatarUrl: row.gymMember?.avatarUrl ?? null,
  };
}

async function pollOnce(config: ReceptionConfig, onCheckIn: PollHandler) {
  const result = await apiRequest<{
    checkIns: Array<{
      id: string;
      subjectType: string;
      direction: string;
      method: string;
      checkedInAt: string;
      gymMember?: { firstName: string; lastName: string; avatarUrl?: string | null } | null;
      staffUser?: { name: string } | null;
      device?: { name: string } | null;
    }>;
  }>(config, 'GET', '/api/v1/check-ins?sinceHours=24&limit=50');

  if (!result.ok || !result.data?.checkIns) {
    return;
  }

  const sorted = [...result.data.checkIns].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
  );

  for (const row of sorted) {
    if (!knownIds.has(row.id)) {
      knownIds.add(row.id);
      onCheckIn(mapCheckIn(row));
    }
  }
}

export function seedKnownCheckInIds(ids: string[]) {
  knownIds = new Set(ids);
}

export function startCheckInPolling(config: ReceptionConfig, onCheckIn: PollHandler) {
  stopCheckInPolling();
  void pollOnce(config, onCheckIn);
  pollTimer = setInterval(() => {
    void pollOnce(config, onCheckIn);
  }, 20_000);
}

export function stopCheckInPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function fetchRecentCheckIns(config: ReceptionConfig) {
  const result = await apiRequest<{
    checkIns: Array<{
      id: string;
      subjectType: string;
      direction: string;
      method: string;
      checkedInAt: string;
      gymMember?: { firstName: string; lastName: string; avatarUrl?: string | null } | null;
      staffUser?: { name: string } | null;
      device?: { name: string } | null;
    }>;
    todayCount: number;
  }>(config, 'GET', '/api/v1/check-ins?sinceHours=24&limit=80');

  if (!result.ok || !result.data?.checkIns) {
    return { items: [] as CheckInNotificationPayload[], todayCount: 0 };
  }

  const items = result.data.checkIns.map(mapCheckIn);
  seedKnownCheckInIds(items.map((item) => item.id));
  return { items, todayCount: result.data.todayCount };
}
