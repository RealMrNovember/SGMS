import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push/send';
import type { GoalTargetType } from '@sgms/database';
import { computeGoalProgress, isValidMeasurementField } from './progress';

const WORKOUT_FREQUENCY_WINDOW_DAYS = 7;

function decimalToNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/**
 * Bir ölçüm/check-in eklendiği anda o sporcunun ilgili ACTIVE hedeflerini
 * yeniden değerlendirir; hedefe ulaşılmışsa ACHIEVED işaretler ve sporcuya
 * (+ hedefi atayan PT'ye) push bildirimi gönderir.
 *
 * **Kapsam kararı:** Faz 27.3 (serverless kuyruk motoru) henüz yok, yani
 * "hedef süresine 3 gün kala" gibi zamana bağlı (cron) hatırlatmalar bu fazda
 * yapılamıyor — bunun yerine olay-tetiklemeli (event-driven) bir tasarım
 * seçildi: yeni ölçüm/check-in kaydedildiği her an, o anda "hedefe ulaşıldı mı"
 * kontrol edilir. Süre bazlı hatırlatma Faz 27.3 sonrasına not düşüldü.
 */
export async function reevaluateGoalsForMember(
  organizationId: string,
  gymMemberId: string,
  trigger: 'measurement' | 'checkin',
): Promise<void> {
  try {
    const relevantTypes: GoalTargetType[] =
      trigger === 'measurement'
        ? ['WEIGHT_LOSS', 'WEIGHT_GAIN', 'BODY_FAT_REDUCTION', 'MEASUREMENT_CHANGE']
        : ['WORKOUT_FREQUENCY'];

    const goals = await prisma.athleteGoal.findMany({
      where: { organizationId, gymMemberId, status: 'ACTIVE', targetType: { in: relevantTypes } },
    });
    if (goals.length === 0) {
      return;
    }

    const latest =
      trigger === 'measurement'
        ? await prisma.healthMeasurement.findFirst({
            where: { organizationId, gymMemberId },
            orderBy: { measuredAt: 'desc' },
          })
        : null;

    const workoutCount =
      trigger === 'checkin'
        ? await prisma.checkIn.count({
            where: {
              organizationId,
              gymMemberId,
              direction: 'ENTRY',
              checkedInAt: { gte: new Date(Date.now() - WORKOUT_FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
            },
          })
        : null;

    for (const goal of goals) {
      let currentValue: number | null = null;
      if (goal.targetType === 'WORKOUT_FREQUENCY') {
        currentValue = workoutCount;
      } else if (latest) {
        if (goal.targetType === 'WEIGHT_LOSS' || goal.targetType === 'WEIGHT_GAIN') {
          currentValue = decimalToNumberOrNull(latest.weight);
        } else if (goal.targetType === 'BODY_FAT_REDUCTION') {
          currentValue = decimalToNumberOrNull(latest.bodyFatPercentage);
        } else if (goal.targetType === 'MEASUREMENT_CHANGE' && goal.measurementField && isValidMeasurementField(goal.measurementField)) {
          currentValue = decimalToNumberOrNull(latest[goal.measurementField]);
        }
      }

      const progress = computeGoalProgress(
        {
          targetType: goal.targetType,
          targetValue: decimalToNumberOrNull(goal.targetValue),
          startValue: decimalToNumberOrNull(goal.startValue),
          direction: goal.direction,
        },
        currentValue,
      );

      if (!progress.isAchieved) {
        continue;
      }

      await prisma.athleteGoal.update({
        where: { id: goal.id },
        data: { status: 'ACHIEVED', achievedAt: new Date() },
      });

      const member = await prisma.gymMember.findUnique({
        where: { id: gymMemberId },
        select: { userId: true, firstName: true, lastName: true },
      });

      if (member?.userId) {
        await sendPushToUser(member.userId, {
          title: 'Hedefine ulaştın! 🎉',
          body: 'Belirlediğin hedefe ulaştın, tebrikler!',
          url: '/athlete/goals',
          tag: `goal-achieved-${goal.id}`,
        });
      }

      if (goal.createdByType === 'TRAINER' && goal.createdById !== member?.userId) {
        await sendPushToUser(goal.createdById, {
          title: 'Sporcu hedefine ulaştı',
          body: member ? `${member.firstName} ${member.lastName} atadığın hedefe ulaştı.` : 'Bir sporcunuz hedefine ulaştı.',
          url: `/dashboard/members/${gymMemberId}`,
          tag: `goal-achieved-${goal.id}`,
        });
      }
    }
  } catch (error) {
    console.error('[goals] reevaluate failed:', error);
  }
}
