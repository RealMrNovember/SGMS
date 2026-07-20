'use client';

import {
  addHealthMeasurement,
  addOwnHealthMeasurement,
  type AddMeasurementState,
} from '@/actions/measurements';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: AddMeasurementState = {};

const optionalFieldNames = [
  'weight',
  'bodyFatPercentage',
  'muscleMass',
  'height',
  'waistCm',
  'chestCm',
  'hipCm',
  'armCm',
  'thighCm',
  'bodyWaterPercentage',
  'visceralFatRating',
  'restingHeartRate',
] as const;

export function AddMeasurementForm({
  gymMemberId,
  canManage,
  selfService = false,
}: {
  gymMemberId?: string;
  canManage: boolean;
  selfService?: boolean;
}) {
  const t = useTranslations('measurements');
  const action = selfService ? addOwnHealthMeasurement : addHealthMeasurement;
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!canManage && !selfService) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">{t('noPermission')}</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{selfService ? t('selfAddTitle') : t('title')}</h3>
        <p className="muted mt-1 text-sm">{selfService ? t('selfAddSubtitle') : t('subtitle')}</p>
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
        {gymMemberId ? <input type="hidden" name="gymMemberId" value={gymMemberId} /> : null}

        {optionalFieldNames.map((field) => (
          <div key={field} className="space-y-2">
            <label htmlFor={field} className="muted text-sm">
              {t(field)}
            </label>
            <input
              id={field}
              name={field}
              type="number"
              step={field === 'restingHeartRate' ? '1' : '0.1'}
              className="input"
            />
          </div>
        ))}

        <div className="space-y-2">
          <label htmlFor="measuredAt" className="muted text-sm">
            {t('measuredAt')}
          </label>
          <input id="measuredAt" name="measuredAt" type="datetime-local" className="input" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="muted text-sm">
            {t('notes')}
          </label>
          <textarea id="notes" name="notes" rows={2} className="input" />
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
