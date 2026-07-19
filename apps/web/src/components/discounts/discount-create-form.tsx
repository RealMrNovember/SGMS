'use client';

import { createDiscountCode, type DiscountActionState } from '@/actions/discount-codes';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initial: DiscountActionState = {};

export function DiscountCreateForm() {
  const t = useTranslations('faz17.discounts');
  const [state, action, pending] = useActionState(createDiscountCode, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('code')}</label>
          <input name="code" className="input uppercase" required minLength={3} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('type')}</label>
          <select name="type" className="input" defaultValue="PERCENT">
            <option value="PERCENT">{t('types.PERCENT')}</option>
            <option value="FIXED">{t('types.FIXED')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('value')}</label>
          <input name="value" type="number" className="input" min={0.01} step="0.01" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('maxUses')}</label>
          <input name="maxUses" type="number" className="input" min={1} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('validFrom')}</label>
          <input name="validFrom" type="datetime-local" className="input" />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('validUntil')}</label>
          <input name="validUntil" type="datetime-local" className="input" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('createSubmit')}
        </button>
      </form>
    </section>
  );
}
