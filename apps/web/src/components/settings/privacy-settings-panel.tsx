'use client';

import { requestAccountDeletion, type PrivacyActionState } from '@/actions/privacy';
import { saveContractTemplate, type ContractActionState } from '@/actions/contracts';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const privacyInitial: PrivacyActionState = {};
const contractInitial: ContractActionState = {};

export function PrivacySettingsPanel({
  contractTemplateName,
  contractTemplateBody,
}: {
  contractTemplateName: string;
  contractTemplateBody: string;
}) {
  const t = useTranslations('settings.privacy');
  const tFaz18 = useTranslations('faz18');
  const [deletionState, deletionAction, deletionPending] = useActionState(
    requestAccountDeletion,
    privacyInitial,
  );
  const [templateState, templateAction, templatePending] = useActionState(
    saveContractTemplate,
    contractInitial,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-white/5 p-4">
        <h4 className="font-medium">{t('exportTitle')}</h4>
        <p className="muted text-sm leading-6">{t('exportBody')}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/v1/privacy/export"
            className="button button-gold inline-flex px-4 py-2 text-sm"
          >
            {t('downloadJson')}
          </a>
          <a
            href="/api/v1/privacy/export?format=csv"
            className="button inline-flex px-4 py-2 text-sm"
          >
            {t('downloadCsv')}
          </a>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-white/5 p-4">
        <h4 className="font-medium">{tFaz18('contracts.templateTitle')}</h4>
        <p className="muted text-sm leading-6">{tFaz18('contracts.templateHint')}</p>
        <form action={templateAction} className="space-y-3">
          <input type="hidden" name="name" value={contractTemplateName} />
          <textarea
            name="bodyText"
            className="input min-h-48 w-full font-mono text-xs"
            defaultValue={contractTemplateBody}
          />
          <p className="muted text-xs">{tFaz18('contracts.varsHint')}</p>
          {templateState.error ? (
            <p className="text-xs text-rose-400">{templateState.error}</p>
          ) : null}
          {templateState.success ? (
            <p className="text-xs text-emerald-400">{templateState.success}</p>
          ) : null}
          <button type="submit" className="button px-4 py-2 text-sm" disabled={templatePending}>
            {templatePending ? t('saving') : tFaz18('contracts.saveTemplate')}
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <h4 className="font-medium text-rose-100">{t('deletionTitle')}</h4>
        <p className="muted text-sm leading-6">{t('deletionBody')}</p>
        <form action={deletionAction} className="space-y-3">
          <textarea
            name="reason"
            required
            minLength={10}
            className="input min-h-28 w-full"
            placeholder={t('deletionReasonPlaceholder')}
          />
          {deletionState.error ? (
            <p className="text-xs text-rose-400">{deletionState.error}</p>
          ) : null}
          {deletionState.success ? (
            <p className="text-xs text-emerald-400">{deletionState.success}</p>
          ) : null}
          <button
            type="submit"
            className="button border border-rose-500/40 px-4 py-2 text-sm text-rose-100"
            disabled={deletionPending}
          >
            {deletionPending ? t('submitting') : t('deletionSubmit')}
          </button>
        </form>
      </section>
    </div>
  );
}
