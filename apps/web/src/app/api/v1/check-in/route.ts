import { extractDeviceKey } from '@/lib/check-in/device-key';
import { processCheckIn } from '@/lib/check-in/process';
import { validateDeviceKey } from '@/lib/api/device-auth';
import { isStaffContext } from '@/lib/api/auth-context';
import { requireMemberScopedApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
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

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiErrorI18n('invalidJson', 400, request);
    }

    const qrToken = typeof body.qrToken === 'string' ? body.qrToken : undefined;
    const rfidTag = typeof body.rfidTag === 'string' ? body.rfidTag : undefined;
    const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : undefined;

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
      ...meta,
    });

    if (!result.ok) {
      return mapCheckInError(result.code, request);
    }

    return apiOk({
      checkIn: result.checkIn,
      duplicateWithinHour: result.duplicateWithinHour,
      device: { id: device.id, name: device.name },
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
  if (!gymMemberId) {
    return apiErrorI18n('checkInPayloadRequired', 400, request);
  }

  const meta = clientMeta(request);
  const result = await processCheckIn({
    organizationId: context.organizationId,
    method: 'MANUAL',
    actorId: context.userId,
    gymMemberId,
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
