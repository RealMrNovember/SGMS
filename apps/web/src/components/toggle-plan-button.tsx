'use client';

import { toggleGymMembershipPlanActive } from '@/actions/plans';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export function TogglePlanButton({ planId, isActive }: { planId: string; isActive: boolean }) {
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button px-3 py-1.5 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleGymMembershipPlanActive(planId);
        });
      }}
    >
      {pending
        ? tCommon('ellipsis')
        : isActive
          ? tCommon('deactivate')
          : tCommon('activate')}
    </button>
  );
}
