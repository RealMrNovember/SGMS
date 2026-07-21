'use client';

import { cancelAthleteGoal, createOwnAthleteGoal, type GoalActionState } from '@/actions/goals';
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

export function AthleteGoalPanel({ goals }: { goals: GoalListItem[] }) {
  const t = useTranslations('athlete.goals');
  const tGoals = useTranslations('members.goals');
  const [formOpen, setFormOpen] = useState(false);
  const [targetType, setTargetType] = useState<(typeof TARGET_TYPES)[number]>('WEIGHT_LOSS');
  const [createState, createAction, createPending] = useActionState(createOwnAthleteGoal, initialState);
  const [cancelPending, startCancel] = useTransition();
  const [cancelState, setCancelState] = useState<GoalActionState>({});

  function handleCancel(goalId: string) {
    startCancel(async () => {
      const result = await cancelAthleteGoal(goalId);
      setCancelState(result);
    });
  }

  return (
    <div className="space-y-6">
      {cancelState.error ? <p className="text-sm text-rose-300">{cancelState.error}</p> : null}
      {cancelState.success ? <p className="text-sm text-emerald-300">{cancelState.success}</p> : null}

      {formOpen ? (
        <form action={createAction} className="card space-y-4 p-5">
          <h3 className="font-semibold">{t('createTitle')}</h3>

          {createState.error ? <p className="text-sm text-rose-300">{createState.error}</p> : null}
          {createState.success ? <p className="text-sm text-emerald-300">{createState.success}</p> : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="own-goal-target-type">
              {tGoals('targetType')}
            </label>
            <select
              id="own-goal-target-type"
              name="targetType"
              className="input w-full"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as (typeof TARGET_TYPES)[number])}
            >
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tGoals(`targetTypes.${type}`)}
                </option>
              ))}
            </select>
          </div>

          {targetType === 'MEASUREMENT_CHANGE' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="own-goal-measurement-field">
                  {tGoals('measurementField')}
                </label>
                <select id="own-goal-measurement-field" name="measurementField" className="input w-full" defaultValue="waistCm">
                  {MEASUREMENT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {tGoals(`measurementFields.${field}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="own-goal-direction">
                  {tGoals('direction')}
                </label>
                <select id="own-goal-direction" name="direction" className="input w-full" defaultValue="DECREASE">
                  <option value="DECREASE">{tGoals('directionDecrease')}</option>
                  <option value="INCREASE">{tGoals('directionIncrease')}</option>
                </select>
              </div>
            </div>
          ) : null}

          {targetType !== 'CUSTOM' ? (
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="own-goal-target-value">
                {targetType === 'WORKOUT_FREQUENCY' ? tGoals('targetValueWorkoutHint') : tGoals('targetValue')}
              </label>
              <input id="own-goal-target-value" name="targetValue" className="input w-full" inputMode="decimal" />
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="own-goal-target-date">
              {tGoals('targetDate')}
            </label>
            <input id="own-goal-target-date" name="targetDate" type="date" className="input w-full" />
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="own-goal-notes">
              {tGoals('notes')}
            </label>
            <input id="own-goal-notes" name="notes" className="input w-full" maxLength={500} />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={createPending}>
              {createPending ? t('submitting') : t('submit')}
            </button>
            <button type="button" className="button px-4 py-2 text-sm" onClick={() => setFormOpen(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button button-gold px-4 py-2 text-sm" onClick={() => setFormOpen(true)}>
          {t('createButton')}
        </button>
      )}

      {goals.length === 0 ? (
        <p className="muted text-sm">{t('noGoals')}</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="card space-y-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {tGoals(`targetTypes.${goal.targetType}`)}
                  {goal.targetType === 'MEASUREMENT_CHANGE' && goal.measurementField
                    ? ` — ${tGoals(`measurementFields.${goal.measurementField}`)}`
                    : ''}
                </p>
                <span className="badge text-[10px]">{tGoals(`statusLabels.${goal.status}`)}</span>
              </div>
              <p className="muted text-xs">
                {goal.createdByType === 'TRAINER' ? tGoals('createdByTrainer') : tGoals('createdBySelf')}
              </p>
              {goal.progressPercent != null ? (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--gold)]"
                      style={{ width: `${Math.min(100, Math.max(0, goal.progressPercent))}%` }}
                    />
                  </div>
                  <p className="muted text-xs">{tGoals('progressLabel', { percent: Math.round(goal.progressPercent) })}</p>
                </div>
              ) : null}
              {goal.notes ? <p className="muted text-xs">{goal.notes}</p> : null}
              {goal.status === 'ACTIVE' ? (
                <button
                  type="button"
                  className="button px-3 py-1.5 text-xs opacity-80"
                  disabled={cancelPending}
                  onClick={() => handleCancel(goal.id)}
                >
                  {t('cancel')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
