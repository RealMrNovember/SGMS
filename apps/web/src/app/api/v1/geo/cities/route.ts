import { resolveApiContext } from '@/lib/api/auth-context';
import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

const RESULT_LIMIT = 20;

/**
 * Faz 6.4 — arama destekli Şehir seçici. `country` (ISO 3166-1 alpha-2, ör. "TR")
 * zorunludur; `q` verilmezse o ülkenin en kalabalık şehirleri döner (ilk açılışta
 * makul bir varsayılan liste), verilirse `name`/`ascii_name` üzerinde arama yapılır.
 */
export async function GET(request: NextRequest) {
  const authResult = await resolveApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const countryCode = request.nextUrl.searchParams.get('country')?.toUpperCase();
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!countryCode) {
    return apiError('country parametresi zorunludur.', 400);
  }

  const country = await prisma.country.findUnique({ where: { isoCode: countryCode } });
  if (!country) {
    return apiError('Geçersiz ülke kodu.', 404);
  }

  const cities = await prisma.city.findMany({
    where: {
      countryId: country.id,
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { asciiName: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    select: { id: true, name: true, asciiName: true, population: true },
    orderBy: { population: 'desc' },
    take: RESULT_LIMIT,
  });

  return apiOk({ cities, hasDistricts: country.hasDistricts });
}
