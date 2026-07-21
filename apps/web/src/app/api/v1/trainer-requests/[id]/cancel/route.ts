import { cancelOwnTrainerRequest } from '@/actions/trainer-requests';
import { requireAthleteApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const writeBlock = await requireTenantWriteAccess(authResult.context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const { id } = await params;

  const row = await prisma.trainerRequest.findFirst({
    where: {
      id,
      organizationId: authResult.context.organizationId,
      gymMemberId: authResult.context.gymMemberId,
      status: 'PENDING',
    },
  });
  if (!row) {
    return apiError('İptal edilecek bekleyen talep bulunamadı.', 404);
  }

  const result = await cancelOwnTrainerRequest(id);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
