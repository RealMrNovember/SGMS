'use client';

import { startTenantCardCheckout, type TenantCheckoutState } from '@/actions/tenant-checkout';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: TenantCheckoutState = {};

export function TenantCardCheckoutButton({ currency }: { currency: string }) {
  const t = useTranslations('expenses');
  const [state, action, pending] = useActionState(startTenantCardCheckout, initialState);

  return (
    <form action={action} className="inline-flex flex-col items-center gap-1">
      <input type="hidden" name="currency" value={currency} />
      <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
        {pending ? t('redirectingToPayment') : `${t('payWithCard')} (${currency})`}
      </button>
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
    </form>
  );
}
