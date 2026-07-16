'use client';

import { logSetProgress } from '@/actions/program-progress';
import { formatExercisePrescription } from '@/lib/program-content';
import type { WorkoutDay, WorkoutExercise } from '@/lib/program-content';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

type ProgressEntry = { completedSets: number; weightUsed: number | null };

function parseRestSeconds(rest?: string): number | null {
  if (!rest) return null;
  const match = rest.match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const isMinutes = /dk|dakika|min/i.test(rest);
  return isMinutes ? value * 60 : value;
}

function ExerciseRow({
  trainingProgramId,
  dayIndex,
  exerciseIndex,
  exercise,
  initialProgress,
}: {
  trainingProgramId: string;
  dayIndex: number;
  exerciseIndex: number;
  exercise: WorkoutExercise;
  initialProgress?: ProgressEntry;
}) {
  const t = useTranslations('programs.interactive');
  const [pending, startTransition] = useTransition();
  const totalSets =
    typeof exercise.sets === 'number' ? exercise.sets : Number(exercise.sets) || 1;
  const [completedSets, setCompletedSets] = useState(
    Math.min(initialProgress?.completedSets ?? 0, totalSets),
  );
  const [weightUsed, setWeightUsed] = useState<string>(
    initialProgress?.weightUsed != null ? String(initialProgress.weightUsed) : '',
  );
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const restSeconds = parseRestSeconds(exercise.rest);
  const prescription = formatExercisePrescription(exercise);
  const isDone = totalSets > 0 && completedSets >= totalSets;

  useEffect(() => {
    if (restRemaining == null) {
      return;
    }
    if (restRemaining <= 0) {
      setRestRemaining(null);
      return;
    }
    const timer = setTimeout(() => setRestRemaining((v) => (v == null ? null : v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [restRemaining]);

  function handleComplete() {
    if (isDone) {
      return;
    }
    const next = completedSets + 1;
    setCompletedSets(next);
    if (restSeconds) {
      setRestRemaining(restSeconds);
    }

    const parsedWeight = weightUsed.trim() ? Number(weightUsed) : undefined;
    startTransition(async () => {
      await logSetProgress({
        trainingProgramId,
        dayIndex,
        exerciseIndex,
        totalSets,
        weightUsed: parsedWeight != null && Number.isFinite(parsedWeight) ? parsedWeight : undefined,
      });
    });
  }

  return (
    <li className="flex flex-col gap-2 border-t border-[var(--border)]/50 pt-2 first:border-none first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm">{exercise.name}</p>
          {exercise.notes?.trim() ? <p className="muted mt-0.5 text-xs">{exercise.notes}</p> : null}
        </div>
        {prescription ? <span className="badge shrink-0 text-[10px]">{prescription}</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending || isDone}
          className={`button px-3 py-1.5 text-xs ${isDone ? 'opacity-60' : ''}`}
        >
          {isDone ? t('done') : t('markSet', { completed: completedSets, total: totalSets })}
        </button>

        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder={t('weightPlaceholder')}
          value={weightUsed}
          onChange={(e) => setWeightUsed(e.target.value)}
          className="input w-24 text-xs"
        />

        {restRemaining != null ? (
          <span className="badge text-[10px] text-amber-200">{t('resting', { seconds: restRemaining })}</span>
        ) : null}
      </div>
    </li>
  );
}

export function InteractiveWorkoutView({
  trainingProgramId,
  days,
  goal,
  initialProgress,
}: {
  trainingProgramId: string;
  days: WorkoutDay[];
  goal?: string;
  initialProgress: Record<string, ProgressEntry>;
}) {
  const t = useTranslations('programs.interactive');

  return (
    <div className="mt-3 space-y-3">
      {goal?.trim() ? (
        <div>
          <p className="muted text-[10px] uppercase tracking-wide">{t('goal')}</p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{goal}</p>
        </div>
      ) : null}

      {days.map((day, dayIndex) => (
        <div key={day.name} className="rounded-lg border border-[var(--border)]/70 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-sm">{day.name}</p>
            {day.focus?.trim() ? <span className="badge text-[10px]">{day.focus}</span> : null}
          </div>
          <ul className="mt-3 space-y-2">
            {day.exercises.map((exercise, exerciseIndex) => (
              <ExerciseRow
                key={`${day.name}-${exercise.name}`}
                trainingProgramId={trainingProgramId}
                dayIndex={dayIndex}
                exerciseIndex={exerciseIndex}
                exercise={exercise}
                initialProgress={initialProgress[`${dayIndex}-${exerciseIndex}`]}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
