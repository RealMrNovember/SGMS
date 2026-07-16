'use client';

import { recordPayment, type ExpenseActionState } from '@/actions/expenses';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: ExpenseActionState = {};

export function PaymentPlanPayButton({
  gymMemberId,
  expenseId,
  outstanding,
}: {
  gymMemberId: string;
  expenseId: string;
  outstanding: number;
}) {
  const t = useTranslations('expenses');
  const [state, action, pending] = useActionState(recordPayment, initialState);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="gymMemberId" value={gymMemberId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <input type="hidden" name="amount" value={outstanding} />
      <input type="hidden" name="paymentMethod" value="CASH" />
      <button type="submit" disabled={pending} className="button px-3 py-1.5 text-xs">
        {pending ? '…' : t('paymentPlan.pay')}
      </button>
      {state.error ? <span className="text-xs text-rose-300">{state.error}</span> : null}
    </form>
  );
}
