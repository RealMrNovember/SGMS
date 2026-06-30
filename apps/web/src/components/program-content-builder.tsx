'use client';

import {
  defaultProgramContent,
  emptyNutritionMeal,
  emptyWorkoutDay,
  type NutritionMeal,
  type ProgramContent,
  type WorkoutDay,
  type WorkoutExercise,
} from '@/lib/program-content';
import type { ProgramType } from '@sgms/database';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

type ExerciseDraft = WorkoutExercise & { _id: string };
type DayDraft = Omit<WorkoutDay, 'exercises'> & { _id: string; exercises: ExerciseDraft[] };
type MealDraft = NutritionMeal & { _id: string };

function initDays(content: ProgramContent): DayDraft[] {
  const days = content.days?.length ? content.days : [emptyWorkoutDay(0)];
  return days.map((day, i) => ({
    ...day,
    _id: nextId(`day-${i}`),
    exercises: (day.exercises.length ? day.exercises : [{ name: '' }]).map((ex, j) => ({
      ...ex,
      _id: nextId(`ex-${i}-${j}`),
    })),
  }));
}

function initMeals(content: ProgramContent): MealDraft[] {
  const meals = content.meals?.length ? content.meals : [emptyNutritionMeal(0)];
  return meals.map((meal, i) => ({ ...meal, _id: nextId(`meal-${i}`) }));
}

function stripExerciseId(ex: ExerciseDraft): WorkoutExercise {
  const { _id: _, ...rest } = ex;
  return rest;
}

function buildPayload(
  type: ProgramType,
  goal: string,
  days: DayDraft[],
  meals: MealDraft[],
): ProgramContent {
  if (type === 'WORKOUT') {
    return {
      version: 1,
      goal: goal.trim() || undefined,
      days: days.map((day) => {
        const { _id: _, exercises, ...rest } = day;
        return {
          ...rest,
          focus: rest.focus?.trim() || undefined,
          exercises: exercises.map(stripExerciseId),
        };
      }),
    };
  }
  return {
    version: 1,
    goal: goal.trim() || undefined,
    meals: meals.map(({ _id: _, ...meal }) => meal),
  };
}

export function ProgramContentBuilder({ programType }: { programType: ProgramType }) {
  const t = useTranslations('programs.builder');

  const [goal, setGoal] = useState('');
  const [days, setDays] = useState<DayDraft[]>(() => initDays(defaultProgramContent('WORKOUT')));
  const [meals, setMeals] = useState<MealDraft[]>(() => initMeals(defaultProgramContent('NUTRITION')));

  useEffect(() => {
    const base = defaultProgramContent(programType);
    setGoal('');
    if (programType === 'WORKOUT') {
      setDays(initDays(base));
    } else {
      setMeals(initMeals(base));
    }
  }, [programType]);

  const contentJson = useMemo(
    () => JSON.stringify(buildPayload(programType, goal, days, meals)),
    [programType, goal, days, meals],
  );

  if (programType === 'NUTRITION') {
    return (
      <div className="md:col-span-2 space-y-4">
        <input type="hidden" name="contentJson" value={contentJson} />

        <div className="space-y-2">
          <label htmlFor="programGoal" className="muted text-sm">
            {t('goal')}
          </label>
          <textarea
            id="programGoal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            className="input resize-y"
            placeholder={t('goalPlaceholderNutrition')}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t('mealsTitle')}</p>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5"
            onClick={() => setMeals((prev) => [...prev, { ...emptyNutritionMeal(prev.length), _id: nextId('meal') }])}
          >
            {t('addMeal')}
          </button>
        </div>

        <div className="space-y-3">
          {meals.map((meal, mealIndex) => (
            <div
              key={meal._id}
              className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[140px] flex-1 space-y-1">
                  <label className="muted text-xs">{t('mealName')}</label>
                  <input
                    className="input py-2 text-sm"
                    value={meal.name}
                    onChange={(e) =>
                      setMeals((prev) =>
                        prev.map((m) => (m._id === meal._id ? { ...m, name: e.target.value } : m)),
                      )
                    }
                    placeholder={t('mealNamePlaceholder')}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label className="muted text-xs">{t('mealTime')}</label>
                  <input
                    className="input py-2 text-sm"
                    value={meal.time ?? ''}
                    onChange={(e) =>
                      setMeals((prev) =>
                        prev.map((m) => (m._id === meal._id ? { ...m, time: e.target.value } : m)),
                      )
                    }
                    placeholder="08:00"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <label className="muted text-xs">{t('calories')}</label>
                  <input
                    type="number"
                    min={0}
                    className="input py-2 text-sm"
                    value={meal.calories ?? ''}
                    onChange={(e) =>
                      setMeals((prev) =>
                        prev.map((m) =>
                          m._id === meal._id
                            ? { ...m, calories: e.target.value ? Number(e.target.value) : undefined }
                            : m,
                        ),
                      )
                    }
                    placeholder="kcal"
                  />
                </div>
                {meals.length > 1 ? (
                  <button
                    type="button"
                    className="rounded-lg px-2 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
                    onClick={() => setMeals((prev) => prev.filter((m) => m._id !== meal._id))}
                    aria-label={t('removeMeal')}
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="muted text-xs">{t('mealItems')}</label>
                <textarea
                  className="input min-h-20 resize-y text-sm"
                  value={meal.items}
                  onChange={(e) =>
                    setMeals((prev) =>
                      prev.map((m) => (m._id === meal._id ? { ...m, items: e.target.value } : m)),
                    )
                  }
                  placeholder={t('mealItemsPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <label className="muted text-xs">{t('notes')}</label>
                <input
                  className="input py-2 text-sm"
                  value={meal.notes ?? ''}
                  onChange={(e) =>
                    setMeals((prev) =>
                      prev.map((m) => (m._id === meal._id ? { ...m, notes: e.target.value } : m)),
                    )
                  }
                  placeholder={t('mealNotesPlaceholder')}
                />
              </div>

              {mealIndex === 0 ? null : (
                <p className="muted text-[10px]">{t('mealHint')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 space-y-4">
      <input type="hidden" name="contentJson" value={contentJson} />

      <div className="space-y-2">
        <label htmlFor="programGoal" className="muted text-sm">
          {t('goal')}
        </label>
        <textarea
          id="programGoal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="input resize-y"
          placeholder={t('goalPlaceholderWorkout')}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t('daysTitle')}</p>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5"
          onClick={() =>
            setDays((prev) => [...prev, { ...emptyWorkoutDay(prev.length), _id: nextId('day'), exercises: emptyWorkoutDay(prev.length).exercises.map((ex) => ({ ...ex, _id: nextId('ex') })) }])
          }
        >
          {t('addDay')}
        </button>
      </div>

      <div className="space-y-4">
        {days.map((day) => (
          <div
            key={day._id}
            className="rounded-xl border border-[var(--border)] bg-white/[0.02] overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-[120px] flex-1 space-y-1">
                <label className="muted text-xs">{t('dayName')}</label>
                <input
                  className="input py-2 text-sm"
                  value={day.name}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d) => (d._id === day._id ? { ...d, name: e.target.value } : d)),
                    )
                  }
                  placeholder={t('dayNamePlaceholder')}
                />
              </div>
              <div className="min-w-[160px] flex-1 space-y-1">
                <label className="muted text-xs">{t('dayFocus')}</label>
                <input
                  className="input py-2 text-sm"
                  value={day.focus ?? ''}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d) => (d._id === day._id ? { ...d, focus: e.target.value } : d)),
                    )
                  }
                  placeholder={t('dayFocusPlaceholder')}
                />
              </div>
              {days.length > 1 ? (
                <button
                  type="button"
                  className="rounded-lg px-2 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
                  onClick={() => setDays((prev) => prev.filter((d) => d._id !== day._id))}
                  aria-label={t('removeDay')}
                >
                  {t('removeDay')}
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="muted border-b border-[var(--border)] text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('exercise')}</th>
                    <th className="w-16 px-2 py-2 font-medium">{t('sets')}</th>
                    <th className="w-16 px-2 py-2 font-medium">{t('reps')}</th>
                    <th className="w-24 px-2 py-2 font-medium">{t('rest')}</th>
                    <th className="min-w-[120px] px-2 py-2 font-medium">{t('notes')}</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {day.exercises.map((ex) => (
                    <tr key={ex._id} className="border-b border-[var(--border)] last:border-none">
                      <td className="px-4 py-2">
                        <input
                          className="input py-1.5 text-sm"
                          value={ex.name}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d._id === day._id
                                  ? {
                                      ...d,
                                      exercises: d.exercises.map((row) =>
                                        row._id === ex._id ? { ...row, name: e.target.value } : row,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                          placeholder={t('exercisePlaceholder')}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input py-1.5 text-sm text-center"
                          value={ex.sets ?? ''}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d._id === day._id
                                  ? {
                                      ...d,
                                      exercises: d.exercises.map((row) =>
                                        row._id === ex._id ? { ...row, sets: e.target.value } : row,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input py-1.5 text-sm text-center"
                          value={ex.reps ?? ''}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d._id === day._id
                                  ? {
                                      ...d,
                                      exercises: d.exercises.map((row) =>
                                        row._id === ex._id ? { ...row, reps: e.target.value } : row,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input py-1.5 text-sm"
                          value={ex.rest ?? ''}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d._id === day._id
                                  ? {
                                      ...d,
                                      exercises: d.exercises.map((row) =>
                                        row._id === ex._id ? { ...row, rest: e.target.value } : row,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                          placeholder="90 sn"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input py-1.5 text-sm"
                          value={ex.notes ?? ''}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d._id === day._id
                                  ? {
                                      ...d,
                                      exercises: d.exercises.map((row) =>
                                        row._id === ex._id ? { ...row, notes: e.target.value } : row,
                                      ),
                                    }
                                  : d,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {day.exercises.length > 1 ? (
                          <button
                            type="button"
                            className="text-rose-300 hover:text-rose-200"
                            onClick={() =>
                              setDays((prev) =>
                                prev.map((d) =>
                                  d._id === day._id
                                    ? { ...d, exercises: d.exercises.filter((row) => row._id !== ex._id) }
                                    : d,
                                ),
                              )
                            }
                            aria-label={t('removeExercise')}
                          >
                            ✕
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[var(--border)] px-4 py-2">
              <button
                type="button"
                className="text-xs text-[var(--accent)] hover:underline"
                onClick={() =>
                  setDays((prev) =>
                    prev.map((d) =>
                      d._id === day._id
                        ? {
                            ...d,
                            exercises: [
                              ...d.exercises,
                              { name: '', sets: 3, reps: 10, rest: '90 sn', notes: '', _id: nextId('ex') },
                            ],
                          }
                        : d,
                    ),
                  )
                }
              >
                + {t('addExercise')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
