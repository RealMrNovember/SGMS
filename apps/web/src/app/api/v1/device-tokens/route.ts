import { requireAthleteApiContext } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

/** Mobil uygulama Expo push token kaydı. */
export async function POST(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('Geçersiz JSON.', 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : 'android';

  if (!token || token.length < 20) {
    return apiError('Geçerli bir push token gerekli.', 400);
  }

  await prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId: authResult.context.userId,
      platform: platform === 'ios' ? 'ios' : 'android',
    },
    create: {
      userId: authResult.context.userId,
      token,
      platform: platform === 'ios' ? 'ios' : 'android',
    },
  });

  return apiOk({ registered: true });
}
