'use client';

import { createLead, type LeadActionState } from '@/actions/leads';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: LeadActionState = {};
const SOURCES = ['WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'WEBSITE', 'OTHER'] as const;

export function LeadCreateForm() {
  const t = useTranslations('leads');
  const [state, formAction, pending] = useActionState(createLead, initialState);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('addTitle')}</h3>

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
          <label htmlFor="lead-name" className="muted text-sm">
            {t('name')}
          </label>
          <input id="lead-name" name="name" className="input" required minLength={2} maxLength={120} />
          {state.fieldErrors?.name ? <p className="text-xs text-rose-400">{state.fieldErrors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="lead-phone" className="muted text-sm">
            {t('phone')}
          </label>
          <input id="lead-phone" name="phone" className="input" maxLength={30} />
        </div>

        <div className="space-y-2">
          <label htmlFor="lead-email" className="muted text-sm">
            {t('email')}
          </label>
          <input id="lead-email" name="email" type="email" className="input" />
          {state.fieldErrors?.email ? <p className="text-xs text-rose-400">{state.fieldErrors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="lead-source" className="muted text-sm">
            {t('source')}
          </label>
          <select id="lead-source" name="source" className="input" defaultValue="WALK_IN">
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(`sources.${source}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="lead-interestedPlan" className="muted text-sm">
            {t('interestedPlan')}
          </label>
          <input id="lead-interestedPlan" name="interestedPlan" className="input" maxLength={120} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="lead-notes" className="muted text-sm">
            {t('notes')}
          </label>
          <textarea id="lead-notes" name="notes" rows={2} className="input" maxLength={1000} />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-5 py-2.5" disabled={pending}>
            {pending ? t('saving') : t('submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
