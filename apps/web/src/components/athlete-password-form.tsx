'use client';

import { changeOwnPassword, type AthleteProfileActionState } from '@/actions/athlete-profile';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: AthleteProfileActionState = {};

export function AthletePasswordForm() {
  const t = useTranslations('athlete.profile');
  const tCommon = useTranslations('common');
  const [state, action, pending] = useActionState(changeOwnPassword, initialState);

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h3 className="font-semibold">{t('passwordTitle')}</h3>
        <p className="muted mt-1 text-sm">{t('passwordSubtitle')}</p>
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

      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="current-password" className="muted text-xs">
            {t('currentPassword')}
          </label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-password" className="muted text-xs">
            {t('newPassword')}
          </label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-password-confirmation" className="muted text-xs">
            {t('newPasswordConfirmation')}
          </label>
          <input
            id="new-password-confirmation"
            name="newPasswordConfirmation"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </div>
        <button type="submit" disabled={pending} className="button px-4 py-2 text-sm sm:col-span-3">
          {pending ? tCommon('ellipsis') : t('changePassword')}
        </button>
      </form>
    </section>
  );
}
