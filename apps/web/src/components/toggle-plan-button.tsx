'use client';

import { toggleGymMembershipPlanActive } from '@/actions/plans';
import { useTransition } from 'react';

export function TogglePlanButton({ planId, isActive }: { planId: string; isActive: boolean }) {
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
      {pending ? '…' : isActive ? 'Pasifleştir' : 'Aktifleştir'}
    </button>
  );
}
