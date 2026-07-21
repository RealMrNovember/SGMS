'use client';

import { cancelOwnTrainerRequest, requestTrainerChange, type TrainerRequestActionState } from '@/actions/trainer-requests';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

type TrainerOption = {
  userId: string;
  name: string;
  isAtCapacity: boolean;
};

type PendingRequest = {
  id: string;
  requestType: string;
  status: string;
  preferredTrainerName: string | null;
};

export function TrainerRequestForm({
  gymMemberId,
  hasTrainer,
  trainers,
  pendingRequest,
}: {
  gymMemberId: string;
  hasTrainer: boolean;
  trainers: TrainerOption[];
  pendingRequest: PendingRequest | null;
}) {
  const t = useTranslations('faz42.request');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<TrainerRequestActionState>({});

  if (pendingRequest?.status === 'PENDING') {
    return (
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{t('pendingTitle')}</h3>
            <p className="muted mt-1 text-sm">{t('pendingHint')}</p>
            <p className="muted mt-1 text-xs">
              {t(`types.${pendingRequest.requestType}`)}
              {pendingRequest.preferredTrainerName ? ` · ${pendingRequest.preferredTrainerName}` : ''}
            </p>
          </div>
          <span className="badge text-[10px]">{t('pendingBadge')}</span>
        </div>
        <button
          type="button"
          className="button py-2 text-sm opacity-80"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelOwnTrainerRequest(pendingRequest.id);
              setState(result);
            })
          }
        >
          {t('cancel')}
        </button>
        {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
        {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}
      </section>
    );
  }

  const defaultType = hasTrainer ? 'CHANGE' : 'ASSIGN';

  return (
    <section className="card space-y-4 p-5">
      <h3 className="font-semibold">{hasTrainer ? t('changeTitle') : t('assignTitle')}</h3>
      <p className="muted text-xs leading-5">{t('privacyHint')}</p>
      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          const requestType = String(formData.get('requestType') ?? defaultType) as 'ASSIGN' | 'CHANGE' | 'REMOVE';
          const preferredTrainerId = String(formData.get('preferredTrainerId') ?? '') || undefined;
          const reason = String(formData.get('reason') ?? '') || undefined;

          startTransition(async () => {
            const result = await requestTrainerChange({
              requestType,
              preferredTrainerId,
              reason,
              gymMemberId,
            });
            setState(result);
            if (result.success) {
              form.reset();
            }
          });
        }}
      >
        <div className="space-y-1">
          <label className="muted text-xs">{t('typeLabel')}</label>
          <select name="requestType" className="input" defaultValue={defaultType}>
            {!hasTrainer ? <option value="ASSIGN">{t('types.ASSIGN')}</option> : null}
            {hasTrainer ? <option value="CHANGE">{t('types.CHANGE')}</option> : null}
            {hasTrainer ? <option value="REMOVE">{t('types.REMOVE')}</option> : null}
          </select>
        </div>

        <div className="space-y-1">
          <label className="muted text-xs">{t('preferredLabel')}</label>
          <select name="preferredTrainerId" className="input" defaultValue="">
            <option value="">{t('noPreference')}</option>
            {trainers.map((trainer) => (
              <option key={trainer.userId} value={trainer.userId}>
                {trainer.name}
                {trainer.isAtCapacity ? ` (${t('atCapacity')})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="muted text-xs">{t('reasonLabel')}</label>
          <textarea name="reason" className="input min-h-[80px]" maxLength={2000} placeholder={t('reasonPlaceholder')} />
        </div>

        <button type="submit" className="button button-gold w-full py-2.5 text-sm" disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </button>
      </form>
    </section>
  );
}
