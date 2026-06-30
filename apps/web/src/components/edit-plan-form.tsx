'use client';

import { updateGymMembershipPlan, type PlanFormState } from '@/actions/plans';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: PlanFormState = {};

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  price: string;
  currency: string;
  sortOrder: number;
};

export function EditPlanForm({ plan }: { plan: PlanRow }) {
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(updateGymMembershipPlan, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-6">
      <input type="hidden" name="planId" value={plan.id} />

      <input name="name" defaultValue={plan.name} className="input text-sm" required />
      <input
        name="durationDays"
        type="number"
        min={1}
        defaultValue={plan.durationDays}
        className="input text-sm"
        required
      />
      <input
        name="price"
        type="number"
        min={0}
        step="0.01"
        defaultValue={plan.price}
        className="input text-sm"
        required
      />
      <select name="currency" defaultValue={plan.currency} className="input text-sm">
        <option value="TRY">TRY</option>
        <option value="USD">USD</option>
        <option value="AZN">AZN</option>
      </select>
      <input
        name="sortOrder"
        type="number"
        min={0}
        defaultValue={plan.sortOrder}
        className="input text-sm"
      />
      <button type="submit" className="button px-3 py-2 text-xs" disabled={pending}>
        {pending ? tCommon('ellipsis') : tCommon('save')}
      </button>

      <input
        name="description"
        defaultValue={plan.description ?? ''}
        placeholder={tCommon('description')}
        className="input text-sm md:col-span-5"
      />

      {state.error ? (
        <p className="text-xs text-rose-300 md:col-span-6">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-emerald-300 md:col-span-6">{state.success}</p>
      ) : null}
    </form>
  );
}
