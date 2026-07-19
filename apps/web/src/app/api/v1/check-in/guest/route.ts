import { extractDeviceKey } from '@/lib/check-in/device-key';
import { parseDirection, processCheckIn } from '@/lib/check-in/process';
import { isGuestPassQrToken } from '@/lib/check-in/guest-qr';
import { validateDeviceKey } from '@/lib/api/device-auth';
import { assertDeviceCheckInAllowed } from '@/lib/billing/assert-device-checkin';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';

function clientMeta(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  };
}

/** Misafir kartı QR ile turnike girişi — `sgms_guest_` önekli token. */
export async function POST(request: Request) {
  const deviceKey = extractDeviceKey(request);
  if (!deviceKey) {
    return apiErrorI18n('deviceKeyInvalid', 401, request);
  }

  const device = await validateDeviceKey(deviceKey);
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

  const qrToken = typeof body.qrToken === 'string' ? body.qrToken : undefined;
  if (!qrToken || !isGuestPassQrToken(qrToken)) {
    return apiErrorI18n('checkInInvalidQr', 400, request);
  }

  const direction = parseDirection(body.direction);
  const clientEventId = typeof body.clientEventId === 'string' ? body.clientEventId : undefined;
  const meta = clientMeta(request);

  const result = await processCheckIn({
    organizationId: device.organizationId,
    method: 'QR',
    deviceId: device.id,
    qrToken,
    clientEventId,
    direction,
    ...meta,
  });

  if (!result.ok) {
    switch (result.code) {
      case 'invalid_guest_pass':
      case 'invalid_qr':
        return apiErrorI18n('checkInInvalidQr', 400, request);
      case 'guest_pass_expired':
        return apiErrorI18n('checkInMembershipExpired', 403, request);
      case 'guest_pass_revoked':
      case 'guest_pass_used':
        return apiErrorI18n('checkInMemberInactive', 403, request);
      case 'too_rapid':
        return apiErrorI18n('checkInTooRapid', 429, request);
      default:
        return apiErrorI18n('memberNotFound', 404, request);
    }
  }

  return apiOk({ checkIn: result.checkIn, duplicateWithinHour: result.duplicateWithinHour });
}
