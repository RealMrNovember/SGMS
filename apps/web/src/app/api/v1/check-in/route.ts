import { extractDeviceKey } from '@/lib/check-in/device-key';
import { parseDirection, processCheckIn } from '@/lib/check-in/process';
import { validateDeviceKey } from '@/lib/api/device-auth';
import { isStaffContext } from '@/lib/api/auth-context';
import { requireMemberScopedApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { assertDeviceCheckInAllowed } from '@/lib/billing/assert-device-checkin';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import type { CheckInMethod } from '@sgms/database';

function clientMeta(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  };
}

function mapCheckInError(code: string, request: Request) {
  switch (code) {
    case 'member_inactive':
      return apiErrorI18n('checkInMemberInactive', 403, request);
    case 'membership_expired':
      return apiErrorI18n('checkInMembershipExpired', 403, request);
    case 'invalid_qr':
      return apiErrorI18n('checkInInvalidQr', 400, request);
    case 'qr_already_used':
      return apiErrorI18n('checkInQrAlreadyUsed', 409, request);
    case 'too_rapid':
      return apiErrorI18n('checkInTooRapid', 429, request);
    default:
      return apiErrorI18n('memberNotFound', 404, request);
  }
}

export async function POST(request: Request) {
  const deviceKey = extractDeviceKey(request);

  if (deviceKey) {
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
    const rfidTag = typeof body.rfidTag === 'string' ? body.rfidTag : undefined;
    const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : undefined;
    const clientEventId = typeof body.clientEventId === 'string' ? body.clientEventId : undefined;
    const direction = parseDirection(body.direction);

    if (!qrToken && !rfidTag && !gymMemberId) {
      return apiErrorI18n('checkInPayloadRequired', 400, request);
    }

    const method: CheckInMethod = qrToken ? 'QR' : rfidTag ? 'RFID' : 'DEVICE';
    const meta = clientMeta(request);

    const result = await processCheckIn({
      organizationId: device.organizationId,
      method,
      deviceId: device.id,
      gymMemberId,
      qrToken,
      rfidTag,
      clientEventId,
      direction,
      ...meta,
    });

    if (!result.ok) {
      return mapCheckInError(result.code, request);
    }

    return apiOk({
      checkIn: result.checkIn,
      duplicateWithinHour: result.duplicateWithinHour,
      device: { id: device.id, name: device.name },
      subscriptionDevicePhase: deviceAccess.deviceAccess.phase,
    });
  }

  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  if (!isStaffContext(context)) {
    return apiErrorI18n('staffOnlyApi', 403, request);
  }

  const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  const direction = parseDirection(body.direction);
  if (!gymMemberId) {
    return apiErrorI18n('checkInPayloadRequired', 400, request);
  }

  const meta = clientMeta(request);
  const result = await processCheckIn({
    organizationId: context.organizationId,
    method: 'MANUAL',
    actorId: context.userId,
    gymMemberId,
    direction,
    ...meta,
  });

  if (!result.ok) {
    return mapCheckInError(result.code, request);
  }

  return apiOk({
    checkIn: result.checkIn,
    duplicateWithinHour: result.duplicateWithinHour,
  });
}
