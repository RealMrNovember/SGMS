'use client';

import {
  formatExercisePrescription,
  normalizeProgramContent,
} from '@/lib/program-content';
import type { ProgramType } from '@sgms/database';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function ProgramContentView({
  content,
  type,
  defaultExpanded = false,
}: {
  content: unknown;
  type: ProgramType;
  defaultExpanded?: boolean;
}) {
  const t = useTranslations('programs.view');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const normalized = normalizeProgramContent(content, type);

  const hasWorkout = (normalized.days?.length ?? 0) > 0;
  const hasMeals = (normalized.meals?.length ?? 0) > 0;
  const hasGoal = Boolean(normalized.goal?.trim());
  const isEmpty = !hasWorkout && !hasMeals && !hasGoal;

  if (isEmpty) {
    return <p className="muted text-xs">{t('empty')}</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-left text-xs hover:bg-white/[0.04]"
      >
        <span className="font-medium">{expanded ? t('hideDetails') : t('showDetails')}</span>
        <span className="muted">
          {type === 'WORKOUT'
            ? t('summaryWorkout', { count: normalized.days?.length ?? 0 })
            : t('summaryNutrition', { count: normalized.meals?.length ?? 0 })}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white/[0.02] p-4">
          {hasGoal ? (
            <div>
              <p className="muted text-[10px] uppercase tracking-wide">{t('goal')}</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{normalized.goal}</p>
            </div>
          ) : null}

          {hasWorkout ? (
            <div className="space-y-3">
              {normalized.days!.map((day) => (
                <div key={day.name} className="rounded-lg border border-[var(--border)]/70 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-sm">{day.name}</p>
                    {day.focus?.trim() ? (
                      <span className="badge text-[10px]">{day.focus}</span>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {day.exercises.map((ex) => {
                      const prescription = formatExercisePrescription(ex);
                      return (
                        <li
                          key={`${day.name}-${ex.name}`}
                          className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--border)]/50 pt-2 first:border-none first:pt-0"
                        >
                          <div>
                            <p className="text-sm">{ex.name}</p>
                            {ex.notes?.trim() ? (
                              <p className="muted mt-0.5 text-xs">{ex.notes}</p>
                            ) : null}
                          </div>
                          {prescription ? (
                            <span className="badge shrink-0 text-[10px]">{prescription}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {hasMeals ? (
            <div className="space-y-3">
              {normalized.meals!.map((meal) => (
                <div key={meal.name} className="rounded-lg border border-[var(--border)]/70 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-sm">{meal.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {meal.time?.trim() ? (
                        <span className="badge text-[10px]">{meal.time}</span>
                      ) : null}
                      {meal.calories ? (
                        <span className="badge text-[10px]">{meal.calories} kcal</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{meal.items}</p>
                  {meal.notes?.trim() ? (
                    <p className="muted mt-2 text-xs">{meal.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
