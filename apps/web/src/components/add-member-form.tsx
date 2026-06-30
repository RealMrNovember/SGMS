'use client';

import { addGymMember, type AddGymMemberState } from '@/actions/members';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: AddGymMemberState = {};

type PlanOption = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
};

export function AddMemberForm({
  canManage,
  plans,
}: {
  canManage: boolean;
  plans: PlanOption[];
}) {
  const t = useTranslations('members.add');
  const [state, formAction, pending] = useActionState(addGymMember, initialState);

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">{t('noPermission')}</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="firstName" className="muted text-sm">
            {t('firstName')}
          </label>
          <input id="firstName" name="firstName" className="input" required />
          {state.fieldErrors?.firstName ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.firstName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="lastName" className="muted text-sm">
            {t('lastName')}
          </label>
          <input id="lastName" name="lastName" className="input" required />
          {state.fieldErrors?.lastName ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.lastName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="nationalId" className="muted text-sm">
            {t('nationalId')}
          </label>
          <input
            id="nationalId"
            name="nationalId"
            className="input"
            inputMode="numeric"
            pattern="\d{11}"
            placeholder={t('nationalIdPlaceholder')}
          />
          {state.fieldErrors?.nationalId ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.nationalId}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="muted text-sm">
            {t('phone')}
          </label>
          <input id="phone" name="phone" type="tel" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="muted text-sm">
            {t('email')}
          </label>
          <input id="email" name="email" type="email" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="birthDate" className="muted text-sm">
            {t('birthDate')}
          </label>
          <input id="birthDate" name="birthDate" type="date" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="gender" className="muted text-sm">
            {t('gender')}
          </label>
          <select id="gender" name="gender" className="input" defaultValue="UNSPECIFIED">
            <option value="UNSPECIFIED">{t('genderUnspecified')}</option>
            <option value="MALE">{t('genderMale')}</option>
            <option value="FEMALE">{t('genderFemale')}</option>
            <option value="OTHER">{t('genderOther')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="muted text-sm">
            {t('status')}
          </label>
          <select id="status" name="status" className="input" defaultValue="ACTIVE">
            <option value="ACTIVE">{t('statusActive')}</option>
            <option value="INACTIVE">{t('statusInactive')}</option>
            <option value="SUSPENDED">{t('statusSuspended')}</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="planId" className="muted text-sm">
            {t('plan')}
          </label>
          <select id="planId" name="planId" className="input" defaultValue="">
            <option value="">{t('noPlan')}</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {t('planOption', {
                  name: plan.name,
                  days: plan.durationDays,
                  price: plan.price,
                })}
              </option>
            ))}
          </select>
          {state.fieldErrors?.planId ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.planId}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="membershipStartsAt" className="muted text-sm">
            {t('membershipStart')}
          </label>
          <input
            id="membershipStartsAt"
            name="membershipStartsAt"
            type="date"
            className="input"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="muted text-sm">
            {t('notes')}
          </label>
          <textarea id="notes" name="notes" className="input min-h-24 resize-y" rows={3} />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-6 py-3 text-sm" disabled={pending}>
            {pending ? t('saving') : t('submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
