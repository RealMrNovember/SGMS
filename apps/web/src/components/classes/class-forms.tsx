'use client';

import { createGymClass, generateClassSessions, type ClassActionState } from '@/actions/classes';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';

const initial: ClassActionState = {};
const WEEKDAYS = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 0, key: 'sun' },
] as const;

export function ClassCreateForm({ trainers }: { trainers: { id: string; name: string }[] }) {
  const t = useTranslations('faz17.classes');
  const [state, action, pending] = useActionState(createGymClass, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('createTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('name')}</label>
          <input name="name" className="input" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('startTime')}</label>
          <input name="startTime" className="input" placeholder="09:00" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('capacity')}</label>
          <input name="capacity" type="number" className="input" defaultValue={15} min={1} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('duration')}</label>
          <input name="durationMinutes" type="number" className="input" defaultValue={60} min={15} />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('trainer')}</label>
          <select name="trainerId" className="input" defaultValue="">
            <option value="">{t('noTrainer')}</option>
            {trainers.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('room')}</label>
          <input name="roomName" className="input" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('weeklyDays')}</label>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="weeklyDay" value={day.value} className="rounded" />
                {t(`weekdays.${day.key}`)}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('description')}</label>
          <textarea name="description" className="input min-h-[60px]" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('createSubmit')}
        </button>
      </form>
    </section>
  );
}

export function GenerateSessionsButton({ classId }: { classId: string }) {
  const t = useTranslations('faz17.classes');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button py-2 text-sm"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void generateClassSessions(classId, 4);
        })
      }
    >
      {t('generateSessions')}
    </button>
  );
}
