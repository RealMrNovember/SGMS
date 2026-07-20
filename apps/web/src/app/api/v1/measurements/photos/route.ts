import {
  canReadHealthData,
  requireMemberScopedApiContext,
  requireTenantWriteAccess,
} from '@/lib/api/guard';
import { isAthleteContext, isStaffContext, type ApiContext } from '@/lib/api/auth-context';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { readProgressPhotoBuffer, uploadProgressPhoto } from '@/lib/storage';
import type { MeasurementPhotoAngle } from '@sgms/database';

const PHOTO_ANGLES = new Set<MeasurementPhotoAngle>(['FRONT', 'SIDE', 'BACK', 'OTHER']);

async function resolveTargetMemberId(
  context: ApiContext,
  gymMemberIdRaw: unknown,
  request: Request,
) {
  if (isAthleteContext(context)) {
    return context.gymMemberId;
  }

  const gymMemberId = typeof gymMemberIdRaw === 'string' ? gymMemberIdRaw : '';
  if (!gymMemberId) {
    return { error: apiErrorI18n('gymMemberIdRequired', 400, request) } as const;
  }

  return gymMemberId;
}

export async function POST(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  const writeBlock = await requireTenantWriteAccess(context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (isStaffContext(context) && !canReadHealthData(context.role)) {
    return apiErrorI18n('healthAccessDenied', 403, request);
  }

  const contentType = request.headers.get('content-type') ?? '';
  let gymMemberIdRaw: unknown;
  let angleRaw: unknown;
  let healthMeasurementIdRaw: unknown;
  let buffer: Buffer | null = null;
  let mimeType: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiErrorI18n('invalidMultipart', 400, request);
    }

    gymMemberIdRaw = formData.get('gymMemberId');
    angleRaw = formData.get('angle');
    healthMeasurementIdRaw = formData.get('healthMeasurementId');
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return apiErrorI18n('fileRequired', 400, request);
    }

    const fileResult = await readProgressPhotoBuffer(file);
    if (!fileResult.ok) {
      return apiError(fileResult.error, 400);
    }

    buffer = fileResult.buffer;
    mimeType = fileResult.mimeType;
  } else {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiErrorI18n('invalidJson', 400, request);
    }

    gymMemberIdRaw = body.gymMemberId;
    angleRaw = body.angle;
    healthMeasurementIdRaw = body.healthMeasurementId;

    const base64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    const declaredMime = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';

    if (!base64) {
      return apiErrorI18n('fileRequired', 400, request);
    }

    buffer = Buffer.from(base64, 'base64');
    mimeType = declaredMime;

    if (buffer.byteLength > 2 * 1024 * 1024) {
      return apiError('Dosya boyutu 2 MB sınırını aşıyor.', 400);
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return apiError('Yalnızca JPEG, PNG veya WebP yüklenebilir.', 400);
    }
  }

  const memberResult = await resolveTargetMemberId(context, gymMemberIdRaw, request);
  if (typeof memberResult === 'object' && 'error' in memberResult) {
    return memberResult.error;
  }

  const gymMemberId = memberResult;

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId },
  });

  if (!gymMember) {
    return apiErrorI18n('athleteNotInOrg', 404, request);
  }

  const angle =
    typeof angleRaw === 'string' && PHOTO_ANGLES.has(angleRaw as MeasurementPhotoAngle)
      ? (angleRaw as MeasurementPhotoAngle)
      : 'OTHER';

  const healthMeasurementId =
    typeof healthMeasurementIdRaw === 'string' && healthMeasurementIdRaw
      ? healthMeasurementIdRaw
      : null;

  if (healthMeasurementId) {
    const measurement = await prisma.healthMeasurement.findFirst({
      where: { id: healthMeasurementId, organizationId: context.organizationId, gymMemberId },
    });
    if (!measurement) {
      return apiErrorI18n('measurementNotFound', 404, request);
    }
  }

  if (!buffer || !mimeType) {
    return apiErrorI18n('fileRequired', 400, request);
  }

  const photoId = crypto.randomUUID();
  const uploaded = await uploadProgressPhoto({
    organizationId: context.organizationId,
    gymMemberId,
    photoId,
    buffer,
    mimeType,
  });

  const photo = await prisma.measurementPhoto.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId,
      healthMeasurementId,
      angle,
      photoUrl: uploaded.url,
      uploadedById: context.userId,
    },
  });

  return apiOk({ photo }, 201);
}

export async function GET(request: Request) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  if (context.scope === 'staff' && !canReadHealthData(context.role)) {
    return apiErrorI18n('healthAccessDenied', 403, request);
  }

  const requestedMemberId = new URL(request.url).searchParams.get('gymMemberId');
  let gymMemberId: string;

  if (isAthleteContext(context)) {
    if (requestedMemberId && requestedMemberId !== context.gymMemberId) {
      return apiErrorI18n('ownRecordsOnly', 403, request);
    }
    gymMemberId = context.gymMemberId;
  } else {
    gymMemberId = requestedMemberId ?? '';
    if (!gymMemberId) {
      return apiErrorI18n('gymMemberIdRequired', 400, request);
    }
  }

  const photos = await prisma.measurementPhoto.findMany({
    where: { organizationId: context.organizationId, gymMemberId },
    orderBy: { takenAt: 'desc' },
    take: 50,
  });

  return apiOk({ photos, count: photos.length });
}
