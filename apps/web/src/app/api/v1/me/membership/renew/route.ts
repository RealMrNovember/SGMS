import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiError, apiOk } from '@/lib/api/response';
import { startMembershipRenewalCheckout } from '@/lib/membership/renewal-checkout';

/**
 * Mobil uygulama (SGMS Sporcu) için Faz 8.7.1 — web'deki
 * `startAthleteMembershipRenewal` server action'ıyla aynı ortak kütüphaneyi
 * kullanır, yalnızca sonucu `redirect()` yerine JSON döner (mobil, dönen
 * checkoutUrl'i sistem tarayıcısında açar).
 */
export async function POST(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  try {
    const result = await startMembershipRenewalCheckout({ organizationId, gymMemberId });

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
