'use client';

import { assignShift, createShift, type HrActionState } from '@/actions/hr';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initial: HrActionState = {};

const WEEKDAYS = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 0, key: 'sun' },
] as const;

export function ShiftCreateForm() {
  const t = useTranslations('faz22.shifts');
  const [state, action, pending] = useActionState(createShift, initial);

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
          <label className="muted text-sm">{t('dayOfWeek')}</label>
          <select name="dayOfWeek" className="input" defaultValue={1}>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {t(`weekdays.${day.key}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('startTime')}</label>
          <input name="startTime" className="input" placeholder="09:00" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('endTime')}</label>
          <input name="endTime" className="input" placeholder="17:00" required />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('createSubmit')}
        </button>
      </form>
    </section>
  );
}

export function ShiftAssignForm({
  shifts,
  staff,
}: {
  shifts: { id: string; label: string }[];
  staff: { id: string; label: string }[];
}) {
  const t = useTranslations('faz22.shifts');
  const [state, action, pending] = useActionState(assignShift, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('assignTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('shift')}</label>
          <select name="shiftId" className="input" required defaultValue="">
            <option value="" disabled>
              {t('selectShift')}
            </option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('staff')}</label>
          <select name="userId" className="input" required defaultValue="">
            <option value="" disabled>
              {t('selectStaff')}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('weekStartDate')}</label>
          <input name="weekStartDate" type="date" className="input" />
          <p className="muted text-xs">{t('weekStartHint')}</p>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('notes')}</label>
          <input name="notes" className="input" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('assignSubmit')}
        </button>
      </form>
    </section>
  );
}

type CalendarShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  assignments: { userName: string; notes: string | null }[];
};

export function ShiftWeeklyCalendar({
  shiftsByDay,
}: {
  shiftsByDay: Record<number, CalendarShift[]>;
}) {
  const t = useTranslations('faz22.shifts');

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">{t('calendarTitle')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              {WEEKDAYS.map((day) => (
                <th key={day.value} className="px-4 py-3 font-medium">
                  {t(`weekdays.${day.key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {WEEKDAYS.map((day) => {
                const dayShifts = shiftsByDay[day.value] ?? [];
                return (
                  <td key={day.value} className="align-top border-r border-[var(--border)] px-3 py-3 last:border-r-0">
                    {dayShifts.length === 0 ? (
                      <p className="muted text-xs">{t('noShifts')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {dayShifts.map((shift) => (
                          <li key={shift.id} className="rounded border border-[var(--border)] p-2">
                            <p className="font-medium">{shift.name}</p>
                            <p className="muted text-xs">
                              {shift.startTime}–{shift.endTime}
                            </p>
                            {shift.assignments.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 text-xs">
                                {shift.assignments.map((a, i) => (
                                  <li key={i}>{a.userName}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="muted mt-1 text-xs">{t('unassigned')}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
