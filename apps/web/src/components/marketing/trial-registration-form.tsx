'use client';

import {
  registerTrialOrganization,
  type RegisterTrialState,
} from '@/actions/trial-registration';
import { siteConfig } from '@/lib/site-config';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const initialState: RegisterTrialState = {};

export function TrialRegistrationForm() {
  const t = useTranslations('marketing.trialForm');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(registerTrialOrganization, initialState);

  if (state.success) {
    return (
      <div className="trial-panel space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-2xl">
          ✓
        </div>
        <h2 className="text-2xl font-semibold">{t('successTitle')}</h2>
        <p className="muted text-sm leading-7">{state.success}</p>
        <Link
          href={`/login?email=${encodeURIComponent(state.loginEmail ?? '')}`}
          className="button button-gold inline-flex px-6 py-3"
        >
          {t('goToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="trial-panel space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 text-sm leading-7">{t('subtitle', { days: siteConfig.trialDays })}</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="gymName" className="muted text-sm">
          {t('gymName')}
        </label>
        <input id="gymName" name="gymName" required className="input" placeholder={t('gymNamePlaceholder')} />
        {state.fieldErrors?.gymName ? (
          <p className="text-xs text-rose-300">{state.fieldErrors.gymName}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="ownerName" className="muted text-sm">
            {t('ownerName')}
          </label>
          <input id="ownerName" name="ownerName" required className="input" />
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className="muted text-sm">
            {t('phone')}
          </label>
          <input id="phone" name="phone" type="tel" className="input" />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="ownerEmail" className="muted text-sm">
          {t('ownerEmail')}
        </label>
        <input id="ownerEmail" name="ownerEmail" type="email" required className="input" />
        {state.fieldErrors?.ownerEmail ? (
          <p className="text-xs text-rose-300">{state.fieldErrors.ownerEmail}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="ownerPassword" className="muted text-sm">
          {t('ownerPassword')}
        </label>
        <input id="ownerPassword" name="ownerPassword" type="password" minLength={8} required className="input" />
        <p className="muted text-xs">{t('passwordHint')}</p>
      </div>

      <input type="hidden" name="country" value="TR" />

      <ul className="muted space-y-2 border-t border-[var(--border)] pt-4 text-xs leading-6">
        <li>• {t('benefit1', { days: siteConfig.trialDays })}</li>
        <li>• {t('benefit2')}</li>
        <li>• {t('benefit3')}</li>
      </ul>

      <button type="submit" disabled={pending} className="button button-gold w-full py-3">
        {pending ? tCommon('loading') : t('submit')}
      </button>

      <p className="muted text-center text-xs">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-[#c9a962] hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </form>
  );
}
