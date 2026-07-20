'use client';

import {
  startAthleteMembershipRenewal,
  type MembershipRenewalState,
} from '@/actions/membership-renewal';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: MembershipRenewalState = {};

export function MembershipRenewalButton() {
  const t = useTranslations('athlete.renewal');
  const [state, action, pending] = useActionState(startAthleteMembershipRenewal, initialState);

  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <button type="submit" className="button button-gold px-5 py-2.5 text-sm" disabled={pending}>
        {pending ? t('buttonPending') : t('button')}
      </button>
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
    </form>
  );
}
