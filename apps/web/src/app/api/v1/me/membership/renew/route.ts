import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiError, apiOk } from '@/lib/api/response';
import { startMembershipRenewalCheckout } from '@/lib/membership/renewal-checkout';

/**
 * Mobil uygulama (SGMS Sporcu) için Faz 8.7.1 — web'deki
 * `startAthleteMembershipRenewal` server action'ıyla aynı ortak kütüphaneyi
 * kullanır, yalnızca sonucu `redirect()` yerine JSON döner (mobil, dönen
 * checkoutUrl'i sistem tarayıcısında açar).
 *
 * Body (opsiyonel): `{ "planId": "..." }` — ilk üyelik satışı veya paket seçimi.
 */
export async function POST(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  let planId: string | undefined;
  try {
    const body = (await request.json()) as { planId?: unknown };
    if (typeof body.planId === 'string' && body.planId.trim()) {
      planId = body.planId.trim();
    }
  } catch {
    // Body yoksa mevcut plan yenilenir.
  }

  try {
    const result = await startMembershipRenewalCheckout({
      organizationId,
      gymMemberId,
      planId,
    });

    if (!result.ok) {
      return apiError(result.error, 400);
    }

    if ('renewedImmediately' in result) {
      return apiOk({ renewedImmediately: true, newEndsAt: result.newEndsAt });
    }

    return apiOk({ checkoutUrl: result.checkoutUrl });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Yenileme başlatılamadı.', 500);
  }
}
