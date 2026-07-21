import { prisma } from '@/lib/prisma';
import type { AthleteGoal } from '@sgms/database';
import { computeGoalProgress, isValidMeasurementField, type GoalProgress } from './progress';

const WORKOUT_FREQUENCY_WINDOW_DAYS = 7;

function decimalToNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/**
 * Belirli bir sporcu için hedefin "şu anki" değerini canlı hesaplar — asla
 * kaydedilmiş bir "ilerleme" alanından okunmaz (bkz. `computeGoalProgress`).
 */
async function resolveCurrentValues(
  organizationId: string,
  gymMemberId: string,
  goals: Pick<AthleteGoal, 'targetType' | 'measurementField'>[],
): Promise<{
  weight: number | null;
  bodyFatPercentage: number | null;
  measurementByField: Partial<Record<string, number | null>>;
  workoutCount: number | null;
}> {
  const needsMeasurement = goals.some((g) =>
    ['WEIGHT_LOSS', 'WEIGHT_GAIN', 'BODY_FAT_REDUCTION', 'MEASUREMENT_CHANGE'].includes(g.targetType),
  );
  const needsWorkoutCount = goals.some((g) => g.targetType === 'WORKOUT_FREQUENCY');

  const [latest, workoutCount] = await Promise.all([
    needsMeasurement
      ? prisma.healthMeasurement.findFirst({
          where: { organizationId, gymMemberId },
          orderBy: { measuredAt: 'desc' },
        })
      : Promise.resolve(null),
    needsWorkoutCount
      ? prisma.checkIn.count({
          where: {
            organizationId,
            gymMemberId,
            direction: 'ENTRY',
            checkedInAt: { gte: new Date(Date.now() - WORKOUT_FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
          },
        })
      : Promise.resolve(null),
  ]);

  const measurementByField: Partial<Record<string, number | null>> = {};
  if (latest) {
    for (const goal of goals) {
      if (goal.targetType === 'MEASUREMENT_CHANGE' && goal.measurementField && isValidMeasurementField(goal.measurementField)) {
        measurementByField[goal.measurementField] = decimalToNumberOrNull(latest[goal.measurementField]);
      }
    }
  }

  return {
    weight: latest ? decimalToNumberOrNull(latest.weight) : null,
    bodyFatPercentage: latest ? decimalToNumberOrNull(latest.bodyFatPercentage) : null,
    measurementByField,
    workoutCount,
  };
}

function currentValueForGoal(
  goal: Pick<AthleteGoal, 'targetType' | 'measurementField'>,
  values: Awaited<ReturnType<typeof resolveCurrentValues>>,
): number | null {
  switch (goal.targetType) {
    case 'WEIGHT_LOSS':
    case 'WEIGHT_GAIN':
      return values.weight;
    case 'BODY_FAT_REDUCTION':
      return values.bodyFatPercentage;
    case 'MEASUREMENT_CHANGE':
      return goal.measurementField ? values.measurementByField[goal.measurementField] ?? null : null;
    case 'WORKOUT_FREQUENCY':
      return values.workoutCount;
    default:
      return null;
  }
}

/** Süresi geçmiş ama hâlâ ACTIVE olan hedefleri MISSED işaretler (zamanlanmış iş yerine, okuma anında best-effort). */
export async function expireOverdueGoals(organizationId: string, gymMemberId?: string): Promise<void> {
  try {
    await prisma.athleteGoal.updateMany({
      where: {
        organizationId,
        ...(gymMemberId ? { gymMemberId } : {}),
        status: 'ACTIVE',
        targetDate: { not: null, lt: new Date() },
      },
      data: { status: 'MISSED' },
    });
  } catch (error) {
    console.error('[goals] expire sweep failed:', error);
  }
}

export type AthleteGoalWithProgress = AthleteGoal & { progress: GoalProgress };

export async function listAthleteGoalsWithProgress(
  organizationId: string,
  gymMemberId: string,
): Promise<AthleteGoalWithProgress[]> {
  await expireOverdueGoals(organizationId, gymMemberId);

  const goals = await prisma.athleteGoal.findMany({
    where: { organizationId, gymMemberId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  if (goals.length === 0) {
    return [];
  }

  const values = await resolveCurrentValues(organizationId, gymMemberId, goals);

  return goals.map((goal) => ({
    ...goal,
    progress: computeGoalProgress(
      {
        targetType: goal.targetType,
        targetValue: decimalToNumberOrNull(goal.targetValue),
        startValue: decimalToNumberOrNull(goal.startValue),
        direction: goal.direction,
      },
      currentValueForGoal(goal, values),
    ),
  }));
}
