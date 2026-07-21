import { prisma } from '@/lib/prisma';
import type { GoalCreatedByType, GoalDirection, GoalTargetType } from '@sgms/database';
import { isValidMeasurementField } from './progress';

export type CreateAthleteGoalInput = {
  organizationId: string;
  gymMemberId: string;
  createdByType: GoalCreatedByType;
  createdById: string;
  targetType: GoalTargetType;
  measurementField?: string | null;
  direction?: GoalDirection | null;
  targetValue: number | null;
  targetDate?: Date | null;
  notes?: string | null;
};

export type CreateAthleteGoalResult =
  | { ok: true; goalId: string }
  | { ok: false; error: string };

function decimalToNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/**
 * Yeni bir `AthleteGoal` oluşturur. `startValue` sporcunun hedef konulduğu
 * andaki en son ölçümünden **otomatik** alınır — elle girilmez (bkz.
 * roadmap.md Faz 39). WORKOUT_FREQUENCY/CUSTOM için ölçüm gerekmez.
 *
 * Hem web'deki personel/PT formu hem sporcunun kendi hedefini koyması hem de
 * mobil API rotası **bu tek fonksiyonu** çağırır — doğrulama/başlangıç değeri
 * mantığı tek yerde.
 */
export async function createAthleteGoal(input: CreateAthleteGoalInput): Promise<CreateAthleteGoalResult> {
  const member = await prisma.gymMember.findFirst({
    where: { id: input.gymMemberId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!member) {
    return { ok: false, error: 'Sporcu bu salonda bulunamadı.' };
  }

  if (input.targetType === 'MEASUREMENT_CHANGE') {
    if (!input.measurementField || !isValidMeasurementField(input.measurementField)) {
      return { ok: false, error: 'Geçersiz ölçüm alanı seçildi.' };
    }
    if (!input.direction) {
      return { ok: false, error: 'Hedefin yönünü (azalt/büyüt) seçin.' };
    }
  }

  if (input.targetType !== 'CUSTOM' && (input.targetValue == null || input.targetValue <= 0)) {
    return { ok: false, error: 'Geçerli bir hedef değeri girin.' };
  }

  let startValue: number | null = null;
  if (['WEIGHT_LOSS', 'WEIGHT_GAIN', 'BODY_FAT_REDUCTION', 'MEASUREMENT_CHANGE'].includes(input.targetType)) {
    const latest = await prisma.healthMeasurement.findFirst({
      where: { organizationId: input.organizationId, gymMemberId: input.gymMemberId },
      orderBy: { measuredAt: 'desc' },
    });
    if (!latest) {
      return { ok: false, error: 'Bu hedef türü için önce en az bir ölçüm eklenmeli.' };
    }
    if (input.targetType === 'WEIGHT_LOSS' || input.targetType === 'WEIGHT_GAIN') {
      startValue = decimalToNumberOrNull(latest.weight);
    } else if (input.targetType === 'BODY_FAT_REDUCTION') {
      startValue = decimalToNumberOrNull(latest.bodyFatPercentage);
    } else if (input.measurementField && isValidMeasurementField(input.measurementField)) {
      startValue = decimalToNumberOrNull(latest[input.measurementField]);
    }
    if (startValue == null) {
      return { ok: false, error: 'Bu hedef türü için gereken ölçüm değeri henüz kaydedilmemiş.' };
    }
  }

  const goal = await prisma.athleteGoal.create({
    data: {
      organizationId: input.organizationId,
      gymMemberId: input.gymMemberId,
      createdByType: input.createdByType,
      createdById: input.createdById,
      targetType: input.targetType,
      measurementField: input.targetType === 'MEASUREMENT_CHANGE' ? input.measurementField : null,
      direction: input.targetType === 'MEASUREMENT_CHANGE' ? input.direction : null,
      targetValue: input.targetType === 'CUSTOM' ? input.targetValue : input.targetValue,
      startValue,
      targetDate: input.targetDate ?? null,
      notes: input.notes || null,
      status: 'ACTIVE',
    },
  });

  return { ok: true, goalId: goal.id };
}
