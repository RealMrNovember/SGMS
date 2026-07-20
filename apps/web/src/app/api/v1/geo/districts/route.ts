import { resolveApiContext } from '@/lib/api/auth-context';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

const RESULT_LIMIT = 40;

/** Faz 6.4 — arama destekli İlçe seçici (bugün yalnızca Türkiye'de dolu — bkz. Country.hasDistricts). */
export async function GET(request: NextRequest) {
  const authResult = await resolveApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const cityId = request.nextUrl.searchParams.get('cityId');
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!cityId) {
    return apiError('cityId parametresi zorunludur.', 400);
  }

  const districts = await prisma.district.findMany({
    where: {
      cityId,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: RESULT_LIMIT,
  });

  return apiOk({ districts });
}
