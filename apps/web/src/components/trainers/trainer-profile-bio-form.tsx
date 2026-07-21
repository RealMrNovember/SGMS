'use client';

import { updateTrainerProfileBio, type TrainerRequestActionState } from '@/actions/trainer-requests';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

type Props = {
  trainerUserId: string;
  bio: string | null;
  specialties: string[];
  maxMembers: number | null;
};

const initialState: TrainerRequestActionState = {};

export function TrainerProfileBioForm({ trainerUserId, bio, specialties, maxMembers }: Props) {
  const t = useTranslations('faz42.profile');
  const [state, formAction, pending] = useActionState(updateTrainerProfileBio, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h3 className="font-semibold">{t('title')}</h3>
      <p className="muted text-xs leading-5">{t('hint')}</p>
      <input type="hidden" name="trainerUserId" value={trainerUserId} />

      <div className="space-y-1">
        <label htmlFor="bio" className="muted text-xs">
          {t('bioLabel')}
        </label>
        <textarea id="bio" name="bio" className="input min-h-[100px]" defaultValue={bio ?? ''} maxLength={5000} />
      </div>

      <div className="space-y-1">
        <label htmlFor="specialties" className="muted text-xs">
          {t('specialtiesLabel')}
        </label>
        <input
          id="specialties"
          name="specialties"
          className="input"
          defaultValue={specialties.join(', ')}
          placeholder={t('specialtiesPlaceholder')}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="maxMembers" className="muted text-xs">
          {t('maxMembersLabel')}
        </label>
        <input
          id="maxMembers"
          name="maxMembers"
          type="number"
          min={1}
          className="input"
          defaultValue={maxMembers ?? ''}
        />
      </div>

      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}

      <button type="submit" disabled={pending} className="button button-gold px-5 py-2 text-sm">
        {pending ? t('saving') : t('submit')}
      </button>
    </form>
  );
}
