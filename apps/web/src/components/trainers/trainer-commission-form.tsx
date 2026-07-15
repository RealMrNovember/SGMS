'use client';

import { upsertTrainerProfile, type TrainerActionState } from '@/actions/trainers';
import type { PtCommissionModel } from '@sgms/database';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

type Props = {
  trainerUserId: string;
  currentModel: PtCommissionModel;
  currentBaseRate: number;
  currentHourlyRate: number | null;
};

const initialState: TrainerActionState = {};

export function TrainerCommissionForm({
  trainerUserId,
  currentModel,
  currentBaseRate,
  currentHourlyRate,
}: Props) {
  const t = useTranslations('trainers.commissionForm');
  const [state, formAction, pending] = useActionState(upsertTrainerProfile, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h3 className="font-semibold">{t('title')}</h3>
      <p className="muted text-xs leading-5">{t('hint')}</p>
      <input type="hidden" name="trainerUserId" value={trainerUserId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="commissionModel" className="muted text-xs">
            {t('modelLabel')}
          </label>
          <select id="commissionModel" name="commissionModel" defaultValue={currentModel} className="input">
            <option value="FIXED_PER_SESSION">{t('model.FIXED_PER_SESSION')}</option>
            <option value="PERCENTAGE_OF_REVENUE">{t('model.PERCENTAGE_OF_REVENUE')}</option>
            <option value="TIERED">{t('model.TIERED')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="baseCommissionRate" className="muted text-xs">
            {t('rateLabel')}
          </label>
          <input
            id="baseCommissionRate"
            name="baseCommissionRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={currentBaseRate}
            required
            className="input"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="hourlyRate" className="muted text-xs">
            {t('hourlyRateLabel')}
          </label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={currentHourlyRate ?? ''}
            className="input"
          />
        </div>
      </div>

      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}

      <button type="submit" disabled={pending} className="button button-gold px-5 py-2 text-sm">
        {pending ? t('saving') : t('submit')}
      </button>
    </form>
  );
}
