'use client';

import { assignAthleteGoal, cancelAthleteGoal, type GoalActionState } from '@/actions/goals';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';

const TARGET_TYPES = [
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'BODY_FAT_REDUCTION',
  'MEASUREMENT_CHANGE',
  'WORKOUT_FREQUENCY',
  'CUSTOM',
] as const;

const MEASUREMENT_FIELDS = ['waistCm', 'chestCm', 'hipCm', 'armCm', 'thighCm'] as const;

type GoalListItem = {
  id: string;
  createdByType: 'SELF' | 'TRAINER';
  targetType: (typeof TARGET_TYPES)[number];
  measurementField: string | null;
  targetValue: string | null;
  startValue: string | null;
  targetDate: string | null;
  status: 'ACTIVE' | 'ACHIEVED' | 'MISSED' | 'CANCELLED';
  notes: string | null;
  progressPercent: number | null;
  currentValue: number | null;
};

const initialState: GoalActionState = {};

export function GoalAssignPanel({
  gymMemberId,
  goals,
  canManage,
}: {
  gymMemberId: string;
  goals: GoalListItem[];
  canManage: boolean;
}) {
  const t = useTranslations('members.goals');
  const [assignState, assignAction, assignPending] = useActionState(assignAthleteGoal, initialState);
  const [targetType, setTargetType] = useState<(typeof TARGET_TYPES)[number]>('WEIGHT_LOSS');
  const [cancelPending, startCancel] = useTransition();
  const [cancelState, setCancelState] = useState<GoalActionState>({});

  function handleCancel(goalId: string) {
    startCancel(async () => {
      const result = await cancelAthleteGoal(goalId);
      setCancelState(result);
    });
  }

  return (
    <section className="card space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('activeGoalsTitle')}</h3>
      </div>

      {goals.length === 0 ? (
        <p className="muted text-sm">{t('noGoals')}</p>
      ) : (
        <div className="space-y-3">
          {cancelState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {cancelState.error}
            </p>
          ) : null}
          {cancelState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {cancelState.success}
            </p>
          ) : null}
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {t(`targetTypes.${goal.targetType}`)}
                  {goal.targetType === 'MEASUREMENT_CHANGE' && goal.measurementField
                    ? ` — ${t(`measurementFields.${goal.measurementField}`)}`
                    : ''}
                </p>
                <span className="badge text-[10px]">{t(`statusLabels.${goal.status}`)}</span>
              </div>
              <p className="muted mt-1 text-xs">
                {goal.createdByType === 'TRAINER' ? t('createdByTrainer') : t('createdBySelf')}
              </p>
              {goal.progressPercent != null ? (
                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--gold)]"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progressPercent))}%` }}
                    />
                  </div>
                  <p className="muted text-xs">{t('progressLabel', { percent: Math.round(goal.progressPercent) })}</p>
                </div>
              ) : null}
              {goal.notes ? <p className="muted mt-2 text-xs">{goal.notes}</p> : null}
              {goal.status === 'ACTIVE' && canManage ? (
                <button
                  type="button"
                  className="button mt-3 px-3 py-1.5 text-xs opacity-80"
                  disabled={cancelPending}
                  onClick={() => handleCancel(goal.id)}
                >
                  {t('cancelGoal')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <form action={assignAction} className="space-y-4 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="gymMemberId" value={gymMemberId} />
          <h4 className="text-sm font-semibold">{t('assignTitle')}</h4>
          <p className="muted text-xs">{t('assignSubtitle')}</p>

          {assignState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {assignState.error}
            </p>
          ) : null}
          {assignState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {assignState.success}
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="goal-target-type">
              {t('targetType')}
            </label>
            <select
              id="goal-target-type"
              name="targetType"
              className="input w-full"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as (typeof TARGET_TYPES)[number])}
            >
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`targetTypes.${type}`)}
                </option>
              ))}
            </select>
          </div>

          {targetType === 'MEASUREMENT_CHANGE' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="goal-measurement-field">
                  {t('measurementField')}
                </label>
                <select id="goal-measurement-field" name="measurementField" className="input w-full" defaultValue="waistCm">
                  {MEASUREMENT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {t(`measurementFields.${field}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="goal-direction">
                  {t('direction')}
                </label>
                <select id="goal-direction" name="direction" className="input w-full" defaultValue="DECREASE">
                  <option value="DECREASE">{t('directionDecrease')}</option>
                  <option value="INCREASE">{t('directionIncrease')}</option>
                </select>
              </div>
            </div>
          ) : null}

          {targetType !== 'CUSTOM' ? (
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="goal-target-value">
                {targetType === 'WORKOUT_FREQUENCY' ? t('targetValueWorkoutHint') : t('targetValue')}
              </label>
              <input id="goal-target-value" name="targetValue" className="input w-full" inputMode="decimal" />
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="goal-target-date">
              {t('targetDate')}
            </label>
            <input id="goal-target-date" name="targetDate" type="date" className="input w-full" />
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="goal-notes">
              {t('notes')}
            </label>
            <input id="goal-notes" name="notes" className="input w-full" maxLength={500} />
          </div>

          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={assignPending}>
            {assignPending ? t('submitting') : t('submit')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
