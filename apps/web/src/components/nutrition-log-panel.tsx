'use client';

import { createFoodLogEntry, deleteFoodLogEntry, type NutritionActionState } from '@/actions/nutrition';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealType = (typeof MEAL_TYPES)[number];

type FoodEntryItem = {
  id: string;
  loggedAt: string;
  mealType: MealType;
  foodName: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
};

type DayItem = {
  dateKey: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  entryCount: number;
  entries: FoodEntryItem[];
};

const initialState: NutritionActionState = {};

export function NutritionLogPanel({
  days,
  plannedDailyCalories,
  activeProgramTitle,
}: {
  days: DayItem[];
  plannedDailyCalories: number | null;
  activeProgramTitle: string | null;
}) {
  const t = useTranslations('athlete.nutrition');
  const [formOpen, setFormOpen] = useState(false);
  const [createState, createAction, createPending] = useActionState(createFoodLogEntry, initialState);
  const [deletePending, startDelete] = useTransition();
  const [deleteState, setDeleteState] = useState<NutritionActionState>({});

  function handleDelete(entryId: string) {
    startDelete(async () => {
      const result = await deleteFoodLogEntry(entryId);
      setDeleteState(result);
    });
  }

  const todayKey = new Date().toLocaleDateString('en-CA');
  const today = days.find((d) => d.dateKey === todayKey);

  return (
    <div className="space-y-6">
      {deleteState.error ? <p className="text-sm text-rose-300">{deleteState.error}</p> : null}

      <section className="card p-5">
        <p className="muted text-xs">{t('todayTotal')}</p>
        <p className="mt-1 text-2xl font-semibold">
          {today?.totalCalories ?? 0} <span className="muted text-sm font-normal">kcal</span>
        </p>
        {plannedDailyCalories != null ? (
          <p className="muted mt-2 text-xs">
            {t('planComparison', { planned: plannedDailyCalories, actual: today?.totalCalories ?? 0 })}
            {activeProgramTitle ? ` (${activeProgramTitle})` : ''}
          </p>
        ) : (
          <p className="muted mt-2 text-xs">{t('noPlan')}</p>
        )}
      </section>

      {formOpen ? (
        <form action={createAction} className="card space-y-4 p-5">
          <h3 className="font-semibold">{t('createTitle')}</h3>

          {createState.error ? <p className="text-sm text-rose-300">{createState.error}</p> : null}
          {createState.success ? <p className="text-sm text-emerald-300">{createState.success}</p> : null}

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="food-log-meal-type">
              {t('fields.mealType')}
            </label>
            <select id="food-log-meal-type" name="mealType" className="input w-full" defaultValue="LUNCH">
              {MEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`mealTypes.${type}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="food-log-name">
              {t('fields.foodName')}
            </label>
            <input id="food-log-name" name="foodName" className="input w-full" maxLength={120} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="food-log-calories">
                {t('fields.calories')}
              </label>
              <input id="food-log-calories" name="calories" className="input w-full" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="food-log-protein">
                {t('fields.proteinG')}
              </label>
              <input id="food-log-protein" name="proteinG" className="input w-full" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="food-log-carbs">
                {t('fields.carbsG')}
              </label>
              <input id="food-log-carbs" name="carbsG" className="input w-full" inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="food-log-fat">
                {t('fields.fatG')}
              </label>
              <input id="food-log-fat" name="fatG" className="input w-full" inputMode="decimal" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="muted text-xs" htmlFor="food-log-notes">
              {t('fields.notes')}
            </label>
            <input id="food-log-notes" name="notes" className="input w-full" maxLength={500} />
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

      {days.length === 0 ? (
        <p className="muted text-sm">{t('noEntries')}</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.dateKey} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <p className="font-medium">{day.dateKey}</p>
                <p className="muted text-xs">{t('dayTotal', { calories: day.totalCalories })}</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {day.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t(`mealTypes.${entry.mealType}`)} · {entry.foodName}
                      </p>
                      <p className="muted text-xs">
                        {entry.calories != null ? `${entry.calories} kcal` : t('noCalories')}
                        {entry.proteinG != null ? ` · P ${entry.proteinG}g` : ''}
                        {entry.carbsG != null ? ` · K ${entry.carbsG}g` : ''}
                        {entry.fatG != null ? ` · Y ${entry.fatG}g` : ''}
                      </p>
                      {entry.notes ? <p className="muted mt-1 text-xs">{entry.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="button px-3 py-1.5 text-xs opacity-80"
                      disabled={deletePending}
                      onClick={() => handleDelete(entry.id)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
