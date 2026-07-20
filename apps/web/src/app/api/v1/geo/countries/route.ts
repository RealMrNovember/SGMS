import { resolveApiContext } from '@/lib/api/auth-context';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

const FALLBACK_LOCALE = 'en';

/**
 * Faz 6.4 — arama destekli Ülke seçici için kaynak liste. Yalnızca 250 satır
 * olduğundan istemci tarafında filtrelenir (ayrı bir `q` arama parametresi yok,
 * bkz. /cities ve /districts — onlar çok daha büyük olduğundan sunucu tarafında ararlar).
 */
export async function GET(request: NextRequest) {
  const authResult = await resolveApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const locale = request.nextUrl.searchParams.get('locale') || authResult.context.locale || FALLBACK_LOCALE;

  const countries = await prisma.country.findMany({
    select: {
      isoCode: true,
      callingCode: true,
      hasDistricts: true,
      translations: {
        where: { locale: { in: [locale, FALLBACK_LOCALE] } },
        select: { locale: true, name: true },
      },
    },
  });

  const result = countries
    .map((c) => {
      const preferred = c.translations.find((t) => t.locale === locale);
      const fallback = c.translations.find((t) => t.locale === FALLBACK_LOCALE);
      return {
        isoCode: c.isoCode,
        callingCode: c.callingCode,
        hasDistricts: c.hasDistricts,
        name: preferred?.name ?? fallback?.name ?? c.isoCode,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return apiOk({ countries: result });
}
