import { reviewTrainerRequest } from '@/actions/trainer-requests';
import { requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiError, apiOk } from '@/lib/api/response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireTenantApiContext(request, { roles: ['OWNER', 'ADMIN'] });
  if ('response' in authResult) {
    return authResult.response;
  }

  const writeBlock = await requireTenantWriteAccess(authResult.context.organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const decision = body.decision === 'APPROVE' || body.decision === 'REJECT' ? body.decision : null;
  if (!decision) {
    return apiError('decision APPROVE veya REJECT olmalı.', 400);
  }

  const result = await reviewTrainerRequest({
    requestId: id,
    decision,
    resultingTrainerId:
      typeof body.resultingTrainerId === 'string' ? body.resultingTrainerId : undefined,
  });

  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
