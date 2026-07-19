'use client';

import { recordHealthConsent, type HealthConsentState } from '@/actions/members';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: HealthConsentState = {};

export function HealthConsentForm({
  gymMemberId,
  acceptedAt,
  acceptedByLabel,
  version,
  canManage,
}: {
  gymMemberId: string;
  acceptedAt: string | null;
  acceptedByLabel: string | null;
  version: string | null;
  canManage: boolean;
}) {
  const t = useTranslations('faz18.healthConsent');
  const [state, formAction, pending] = useActionState(recordHealthConsent, initialState);

  if (!canManage && !acceptedAt) {
    return null;
  }

  if (acceptedAt && !canManage) {
    return (
      <section className="card p-6">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-2 text-sm">
          {t('recorded', {
            date: new Date(acceptedAt).toLocaleString(),
            by: acceptedByLabel ?? '—',
            version: version ?? '1.0',
          })}
        </p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="muted mt-2 text-sm leading-6">{t('subtitle')}</p>

      {acceptedAt ? (
        <p className="mt-3 text-sm text-emerald-300">
          {t('recorded', {
            date: new Date(acceptedAt).toLocaleString(),
            by: acceptedByLabel ?? '—',
            version: version ?? '1.0',
          })}
        </p>
      ) : null}

      {canManage ? (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="gymMemberId" value={gymMemberId} />
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="confirm"
              required={!acceptedAt}
              className="mt-1"
              defaultChecked={Boolean(acceptedAt)}
            />
            <span>{t('checkboxLabel')}</span>
          </label>
          <input
            name="version"
            className="input max-w-xs"
            defaultValue={version ?? '1.0'}
            placeholder={t('versionPlaceholder')}
          />
          {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-emerald-400">{state.success}</p> : null}
          <button type="submit" className="button px-4 py-2 text-sm" disabled={pending}>
            {pending ? t('saving') : acceptedAt ? t('update') : t('submit')}
          </button>
        </form>
      ) : null}

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <a
          href={`/api/v1/members/${gymMemberId}/contract-pdf`}
          className="button button-gold inline-flex px-4 py-2 text-sm"
        >
          {t('downloadContract')}
        </a>
      </div>
    </section>
  );
}
