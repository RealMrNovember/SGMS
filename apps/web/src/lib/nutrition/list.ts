import { prisma } from '@/lib/prisma';
import { groupFoodLogEntriesByDay, sumPlannedCaloriesFromProgramContent, type DailyNutritionSummary } from './summary';

const HISTORY_DAYS = 14;

export type NutritionOverview = {
  days: DailyNutritionSummary[];
  /** Aktif `NUTRITION` programındaki öğünlerden toplanan günlük hedef kalori — yoksa `null`. */
  plannedDailyCalories: number | null;
  activeProgramTitle: string | null;
};

/** Sporcunun son 14 güne ait öğün kayıtlarını günlere gruplayıp, varsa aktif beslenme
 * programındaki hedef kaloriyle birlikte döner. Web sporcu portalı, mobil "Beslenme"
 * ekranı ve PT/salon tarafındaki salt-okunur görünüm **hepsi bu tek fonksiyonu** kullanır. */
export async function getNutritionOverviewForMember(
  organizationId: string,
  gymMemberId: string,
): Promise<NutritionOverview> {
  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);

  const [entries, activeNutritionProgram] = await Promise.all([
    prisma.foodLogEntry.findMany({
      where: { organizationId, gymMemberId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.trainingProgram.findFirst({
      where: { organizationId, gymMemberId, type: 'NUTRITION', isActive: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const days = groupFoodLogEntriesByDay(
    entries.map((entry) => ({
      id: entry.id,
      loggedAt: entry.loggedAt,
      mealType: entry.mealType,
      foodName: entry.foodName,
      calories: entry.calories,
      proteinG: entry.proteinG != null ? Number(entry.proteinG) : null,
      carbsG: entry.carbsG != null ? Number(entry.carbsG) : null,
      fatG: entry.fatG != null ? Number(entry.fatG) : null,
      notes: entry.notes,
      photoUrl: entry.photoUrl,
    })),
  );

  return {
    days,
    plannedDailyCalories: activeNutritionProgram
      ? sumPlannedCaloriesFromProgramContent(activeNutritionProgram.content)
      : null,
    activeProgramTitle: activeNutritionProgram?.title ?? null,
  };
}
