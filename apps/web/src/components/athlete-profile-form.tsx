'use client';

import {
  updateOwnDisplayName,
  updateOwnContactInfo,
  type AthleteProfileActionState,
} from '@/actions/athlete-profile';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: AthleteProfileActionState = {};

export function AthleteProfileForm({
  name,
  phone,
  email,
  birthDate,
}: {
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
}) {
  const t = useTranslations('athlete.profile');
  const tCommon = useTranslations('common');
  const [nameState, nameAction, namePending] = useActionState(updateOwnDisplayName, initialState);
  const [contactState, contactAction, contactPending] = useActionState(
    updateOwnContactInfo,
    initialState,
  );

  return (
    <section className="card space-y-6 p-5">
      <div>
        <h3 className="font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {nameState.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {nameState.error}
        </p>
      ) : null}
      {nameState.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {nameState.success}
        </p>
      ) : null}

      <form action={nameAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="athlete-name" className="muted text-xs">
            {t('displayName')}
          </label>
          <input id="athlete-name" name="name" defaultValue={name} required className="input" />
        </div>
        <button type="submit" disabled={namePending} className="button shrink-0 px-4 py-2 text-sm">
          {namePending ? tCommon('ellipsis') : t('save')}
        </button>
      </form>

      {contactState.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {contactState.error}
        </p>
      ) : null}
      {contactState.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {contactState.success}
        </p>
      ) : null}

      <form action={contactAction} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="athlete-phone" className="muted text-xs">
            {t('phone')}
          </label>
          <input id="athlete-phone" name="phone" defaultValue={phone ?? ''} className="input" />
        </div>
        <div className="space-y-1">
          <label htmlFor="athlete-email" className="muted text-xs">
            {t('contactEmail')}
          </label>
          <input
            id="athlete-email"
            name="email"
            type="email"
            defaultValue={email ?? ''}
            className="input"
          />
          <p className="muted text-[10px]">{t('contactEmailHint')}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="athlete-birthdate" className="muted text-xs">
            {t('birthDate')}
          </label>
          <input
            id="athlete-birthdate"
            name="birthDate"
            type="date"
            defaultValue={birthDate ?? ''}
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={contactPending}
          className="button px-4 py-2 text-sm sm:col-span-2"
        >
          {contactPending ? tCommon('ellipsis') : t('save')}
        </button>
      </form>
    </section>
  );
}
