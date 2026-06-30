import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { extractBearerToken, revokeApiTokenByPlain } from '@/lib/api/token';

export async function POST(request: Request) {
  const plainToken = extractBearerToken(request);
  if (!plainToken) {
    return apiErrorI18n('bearerRequired', 401, request);
  }

  const revoked = await revokeApiTokenByPlain(plainToken);
  if (!revoked) {
    return apiErrorI18n('tokenRevokeNotFound', 404, request);
  }

  return apiOk({ revoked: true });
}
