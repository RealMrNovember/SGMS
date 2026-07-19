'use client';

import { createMembershipGroup, type GroupActionState } from '@/actions/membership-groups';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initial: GroupActionState = {};

export function GroupCreateForm() {
  const t = useTranslations('faz17.groups');
  const [state, action, pending] = useActionState(createMembershipGroup, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('name')}</label>
          <input name="name" className="input" required minLength={2} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('type')}</label>
          <select name="type" className="input" defaultValue="FAMILY">
            <option value="INDIVIDUAL">{t('types.INDIVIDUAL')}</option>
            <option value="COUPLE">{t('types.COUPLE')}</option>
            <option value="FAMILY">{t('types.FAMILY')}</option>
            <option value="CORPORATE">{t('types.CORPORATE')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('discountPercent')}</label>
          <input name="discountPercent" type="number" className="input" min={0} max={100} defaultValue={0} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('companyName')}</label>
          <input name="companyName" className="input" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('billingNotes')}</label>
          <textarea name="billingNotes" className="input min-h-[60px]" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('createSubmit')}
        </button>
      </form>
    </section>
  );
}
