import type { GoalDirection, GoalTargetType } from '@sgms/database';

export type GoalProgressInput = {
  targetType: GoalTargetType;
  targetValue: number | null;
  startValue: number | null;
  direction: GoalDirection | null;
};

export type GoalProgress = {
  /** Hedefin şu anki ölçülen değeri (WORKOUT_FREQUENCY için son 7 gündeki check-in sayısı). */
  currentValue: number | null;
  /** 0-100 arası, yuvarlanmış; hesaplanamıyorsa (CUSTOM, veya eksik veri) null. */
  progressPercent: number | null;
  isAchieved: boolean;
};

const MEASUREMENT_FIELDS = ['waistCm', 'chestCm', 'hipCm', 'armCm', 'thighCm'] as const;
export type GoalMeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export function isValidMeasurementField(value: string): value is GoalMeasurementField {
  return (MEASUREMENT_FIELDS as readonly string[]).includes(value);
}

/**
 * WEIGHT_LOSS/BODY_FAT_REDUCTION yönü hep DECREASE, WEIGHT_GAIN hep INCREASE —
 * bunlar zaten adında belirtilir. MEASUREMENT_CHANGE (ör. "kol çevresi") ise hem
 * büyütülmek hem azaltılmak istenebileceğinden goal.direction'dan okunur.
 */
function resolveDirection(goal: GoalProgressInput): GoalDirection | null {
  switch (goal.targetType) {
    case 'WEIGHT_LOSS':
    case 'BODY_FAT_REDUCTION':
      return 'DECREASE';
    case 'WEIGHT_GAIN':
      return 'INCREASE';
    case 'MEASUREMENT_CHANGE':
      return goal.direction ?? null;
    default:
      return null;
  }
}

function clampPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Sporcunun hedefe göre ilerlemesini hesaplar — elle girilen bir "ilerleme"
 * alanı yok, her zaman bu fonksiyonla `HealthMeasurement`/`CheckIn` verisinden
 * türetilir (bkz. roadmap.md Faz 39: "sporcu ilerlemeyi elle girmez").
 */
export function computeGoalProgress(goal: GoalProgressInput, currentValue: number | null): GoalProgress {
  if (goal.targetType === 'CUSTOM') {
    return { currentValue, progressPercent: null, isAchieved: false };
  }

  if (goal.targetType === 'WORKOUT_FREQUENCY') {
    if (goal.targetValue == null || goal.targetValue <= 0 || currentValue == null) {
      return { currentValue, progressPercent: null, isAchieved: false };
    }
    return {
      currentValue,
      progressPercent: clampPercent((currentValue / goal.targetValue) * 100),
      isAchieved: currentValue >= goal.targetValue,
    };
  }

  const direction = resolveDirection(goal);
  if (
    direction == null ||
    goal.startValue == null ||
    goal.targetValue == null ||
    goal.targetValue <= 0 ||
    currentValue == null
  ) {
    return { currentValue, progressPercent: null, isAchieved: false };
  }

  const delta = direction === 'DECREASE' ? goal.startValue - currentValue : currentValue - goal.startValue;
  return {
    currentValue,
    progressPercent: clampPercent((delta / goal.targetValue) * 100),
    isAchieved: delta >= goal.targetValue,
  };
}
