import { extractDeviceKey } from '@/lib/check-in/device-key';
import { processCheckIn, parseDirection } from '@/lib/check-in/process';
import { validateDeviceKey } from '@/lib/api/device-auth';
import { assertDeviceCheckInAllowed } from '@/lib/billing/assert-device-checkin';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import type { CheckInMethod } from '@sgms/database';

type WebhookEvent = {
  clientEventId?: string;
  method?: CheckInMethod;
  direction?: 'ENTRY' | 'EXIT';
  gymMemberId?: string;
  staffUserId?: string;
  rfidTag?: string;
  qrToken?: string;
  checkedInAt?: string;
};

function parseWebhookSecret(request: Request): string | null {
  return (
    request.headers.get('x-webhook-secret') ??
    request.headers.get('x-turnstile-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  );
}

async function resolveDevice(request: Request) {
  const deviceKey = extractDeviceKey(request);
  if (deviceKey) {
    return validateDeviceKey(deviceKey);
  }

  const secret = parseWebhookSecret(request);
  const expected = process.env.TURNSTILE_WEBHOOK_SECRET;
  if (!secret || !expected || secret !== expected) {
    return null;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }

  const hardwareId = typeof body.hardwareId === 'string' ? body.hardwareId : null;
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : null;

  if (!hardwareId || !organizationId) {
    return null;
  }

  const { prisma } = await import('@/lib/prisma');
  return prisma.device.findFirst({
    where: { organizationId, hardwareId, status: { not: 'DISABLED' } },
    select: { id: true, organizationId: true, name: true },
  });
}

function parseEvent(row: unknown): WebhookEvent {
  const item = row as Record<string, unknown>;
  return {
    clientEventId: typeof item.clientEventId === 'string' ? item.clientEventId : undefined,
    method: typeof item.method === 'string' ? (item.method as CheckInMethod) : undefined,
    direction: item.direction === 'ENTRY' || item.direction === 'EXIT' ? item.direction : undefined,
    gymMemberId: typeof item.gymMemberId === 'string' ? item.gymMemberId : undefined,
    staffUserId: typeof item.staffUserId === 'string' ? item.staffUserId : undefined,
    rfidTag: typeof item.rfidTag === 'string' ? item.rfidTag : undefined,
    qrToken: typeof item.qrToken === 'string' ? item.qrToken : undefined,
    checkedInAt: typeof item.checkedInAt === 'string' ? item.checkedInAt : undefined,
  };
}

export async function POST(request: Request) {
  const device = await resolveDevice(request);
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

  const rawEvents = Array.isArray(body.events) ? body.events : [body];
  if (!rawEvents.length || rawEvents.length > 100) {
    return apiErrorI18n('invalidInput', 400, request);
  }

  const results = [];

  for (const raw of rawEvents) {
    const event = parseEvent(raw);
    const clientEventId =
      event.clientEventId ?? `webhook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const checkedInAt = event.checkedInAt ? new Date(event.checkedInAt) : new Date();
    const result = await processCheckIn({
      organizationId: device.organizationId,
      deviceId: device.id,
      method: event.method ?? (event.qrToken ? 'QR' : event.rfidTag ? 'RFID' : 'DEVICE'),
      direction: parseDirection(event.direction),
      clientEventId,
      gymMemberId: event.gymMemberId,
      staffUserId: event.staffUserId,
      rfidTag: event.rfidTag,
      qrToken: event.qrToken,
      checkedInAt: Number.isNaN(checkedInAt.getTime()) ? new Date() : checkedInAt,
    });

    results.push({
      clientEventId,
      ok: result.ok,
      checkInId: result.ok ? result.checkIn.id : undefined,
      code: result.ok ? undefined : result.code,
      idempotent: result.ok ? result.idempotent : undefined,
    });
  }

  return apiOk({
    deviceId: device.id,
    processed: results.length,
    successCount: results.filter((r) => r.ok).length,
    failedCount: results.filter((r) => !r.ok).length,
    results,
  });
}
