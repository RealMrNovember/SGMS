import { issueCheckInQrToken } from '@/lib/check-in/qr-token';
import { requireAthleteApiContext } from '@/lib/api/guard';
import { apiOk } from '@/lib/api/response';

export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const { token, expiresAt } = issueCheckInQrToken(context.organizationId, context.gymMemberId);

  return apiOk({
    token,
    expiresAt: expiresAt.toISOString(),
    refreshAfterSeconds: 240,
  });
}
