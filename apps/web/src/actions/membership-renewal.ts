'use server';

import { auth } from '@/lib/auth';
import { startMembershipRenewalCheckout } from '@/lib/membership/renewal-checkout';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type MembershipRenewalState = {
  error?: string;
};

/**
 * Sporcu portalındaki "Üyeliğimi Yenile" — Faz 8.7.1. Yalnızca sporcu (athlete)
 * oturumu kullanabilir, yalnızca kendi mevcut paketiyle yenileme yapılabilir.
 */
export async function startAthleteMembershipRenewal(
  _prev: MembershipRenewalState,
  _formData: FormData,
): Promise<MembershipRenewalState> {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  if (session.user.isDemo) {
    return { error: 'Demo hesaplar değişiklik yapamaz. Bu bir inceleme hesabıdır.' };
  }

  let redirectTarget: string;

  try {
    const result = await startMembershipRenewalCheckout({
      organizationId: session.user.organizationId,
      gymMemberId: session.user.gymMemberId,
    });

    if (!result.ok) {
      return { error: result.error };
    }

    if ('renewedImmediately' in result) {
      revalidatePath('/athlete');
      revalidatePath('/athlete/account');
      redirectTarget = '/athlete/account?renewal=ok';
    } else {
      redirectTarget = result.checkoutUrl;
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Yenileme başlatılamadı.' };
  }

  redirect(redirectTarget);
}
