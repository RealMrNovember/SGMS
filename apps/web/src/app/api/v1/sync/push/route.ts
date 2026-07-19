import { extractDeviceKey } from '@/lib/check-in/device-key';
import { processSyncPushBatch, type SyncPushEvent } from '@/lib/check-in/sync';
import { validateDeviceKeyForSync } from '@/lib/api/device-auth';
import { assertDeviceCheckInAllowed } from '@/lib/billing/assert-device-checkin';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';

export async function POST(request: Request) {
  const deviceKey = extractDeviceKey(request);
  if (!deviceKey) {
    return apiErrorI18n('deviceKeyRequired', 401, request);
  }

  const device = await validateDeviceKeyForSync(deviceKey);
  if (!device) {
    return apiErrorI18n('deviceKeyInvalid', 401, request);
  }

  const deviceAccess = await assertDeviceCheckInAllowed(device.organizationId);
  if (!deviceAccess.ok) {
    return apiErrorI18n('subscriptionDeviceBlocked', 403, request, {
      phase: deviceAccess.deviceAccess.phase,
      blockReason: deviceAccess.deviceAccess.blockReason,
      graceEndsAt: deviceAccess.deviceAccess.graceEndsAt?.toISOString() ?? null,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const rawEvents = Array.isArray(body.events) ? body.events : [];
  if (rawEvents.length === 0) {
    return apiErrorI18n('invalidInput', 400, request);
  }

  if (rawEvents.length > 500) {
    return apiErrorI18n('invalidInput', 400, request, { reason: 'Max 500 events per batch' });
  }

  const events: SyncPushEvent[] = rawEvents.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      clientEventId: typeof row.clientEventId === 'string' ? row.clientEventId : '',
      method: typeof row.method === 'string' ? (row.method as SyncPushEvent['method']) : undefined,
      gymMemberId: typeof row.gymMemberId === 'string' ? row.gymMemberId : undefined,
      staffUserId: typeof row.staffUserId === 'string' ? row.staffUserId : undefined,
      rfidTag: typeof row.rfidTag === 'string' ? row.rfidTag : undefined,
      qrToken: typeof row.qrToken === 'string' ? row.qrToken : undefined,
      direction:
        row.direction === 'ENTRY' || row.direction === 'EXIT' ? row.direction : undefined,
      conflictPolicy: typeof row.conflictPolicy === 'string'
        ? (row.conflictPolicy as SyncPushEvent['conflictPolicy'])
        : undefined,
      checkedInAt: typeof row.checkedInAt === 'string' ? row.checkedInAt : undefined,
    };
  });

  const result = await processSyncPushBatch({
    organizationId: device.organizationId,
    deviceId: device.id,
    events,
  });

  return apiOk({
    batchId: result.batchId,
    status: result.status,
    results: result.results,
    successCount: result.results.filter((r) => r.ok).length,
    failedCount: result.results.filter((r) => !r.ok).length,
  });
}
