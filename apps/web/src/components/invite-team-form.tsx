'use client';

import { inviteTeamMember, type InviteTeamMemberState } from '@/actions/team';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const initialState: InviteTeamMemberState = {};

export function InviteTeamForm({ canInvite }: { canInvite: boolean }) {
  const t = useTranslations('team.invite');
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);
  const [passwordMode, setPasswordMode] = useState<'email_invite' | 'owner_set'>('email_invite');

  const roleOptions = [
    { value: 'STAFF', label: t('roleStaff') },
    { value: 'TRAINER', label: t('roleTrainer') },
    { value: 'VIEWER', label: t('roleViewer') },
  ] as const;

  if (!canInvite) {
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
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <p>{state.success}</p>
        </div>
      ) : null}

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="muted text-sm">
            {t('name')}
          </label>
          <input id="name" name="name" className="input" required />
          {state.fieldErrors?.name ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="muted text-sm">
            {t('email')}
          </label>
          <input id="email" name="email" type="email" className="input" required />
          {state.fieldErrors?.email ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="role" className="muted text-sm">
            {t('role')}
          </label>
          <select id="role" name="role" className="input" required defaultValue="STAFF">
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.role ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.role}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <span className="muted text-sm">{t('passwordModeLabel')}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="passwordMode"
                value="email_invite"
                checked={passwordMode === 'email_invite'}
                onChange={() => setPasswordMode('email_invite')}
              />
              {t('passwordModeEmailInvite')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="passwordMode"
                value="owner_set"
                checked={passwordMode === 'owner_set'}
                onChange={() => setPasswordMode('owner_set')}
              />
              {t('passwordModeOwnerSet')}
            </label>
          </div>
        </div>

        {passwordMode === 'owner_set' ? (
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="password" className="muted text-sm">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              minLength={8}
              required={passwordMode === 'owner_set'}
            />
            {state.fieldErrors?.password ? (
              <p className="text-xs text-rose-400">{state.fieldErrors.password}</p>
            ) : null}
          </div>
        ) : null}

        <div className="md:col-span-2">
          <button type="submit" className="button px-6 py-3 text-sm" disabled={pending}>
            {pending ? t('saving') : t('submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
