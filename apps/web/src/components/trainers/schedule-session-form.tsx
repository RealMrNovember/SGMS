'use client';

import { schedulePtSession, type TrainerActionState } from '@/actions/trainers';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

type Props = {
  trainerUserId: string;
  members: { id: string; name: string }[];
};

const initialState: TrainerActionState = {};

export function ScheduleSessionForm({ trainerUserId, members }: Props) {
  const t = useTranslations('trainers.scheduleForm');
  const [state, formAction, pending] = useActionState(schedulePtSession, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h3 className="font-semibold">{t('title')}</h3>
      <input type="hidden" name="trainerUserId" value={trainerUserId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-1">
          <label htmlFor="gymMemberId" className="muted text-xs">
            {t('memberLabel')}
          </label>
          <select id="gymMemberId" name="gymMemberId" required className="input">
            <option value="">{t('memberPlaceholder')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="scheduledAt" className="muted text-xs">
            {t('dateLabel')}
          </label>
          <input id="scheduledAt" name="scheduledAt" type="datetime-local" required className="input" />
        </div>
        <div className="space-y-1">
          <label htmlFor="durationMinutes" className="muted text-xs">
            {t('durationLabel')}
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={15}
            max={240}
            step={15}
            defaultValue={60}
            required
            className="input"
          />
        </div>
      </div>

      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}

      <button type="submit" disabled={pending} className="button px-5 py-2 text-sm">
        {pending ? t('saving') : t('submit')}
      </button>
    </form>
  );
}
