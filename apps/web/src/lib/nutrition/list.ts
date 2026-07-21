import { prisma } from '@/lib/prisma';
import { groupFoodLogEntriesByDay, sumPlannedCaloriesFromProgramContent, type DailyNutritionSummary } from './summary';

const HISTORY_DAYS = 14;

export type NutritionOverview = {
  days: DailyNutritionSummary[];
  /** Aktif `NUTRITION` programındaki öğünlerden toplanan günlük hedef kalori — yoksa `null`. */
  plannedDailyCalories: number | null;
  activeProgramTitle: string | null;
  /** Salonun kendi saat dilimi — çağıranların "bugün" hesabını aynı dilimle yapması için dışa açılır. */
  timeZone: string;
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

  const [entries, activeNutritionProgram, organization] = await Promise.all([
    prisma.foodLogEntry.findMany({
      where: { organizationId, gymMemberId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.trainingProgram.findFirst({
      where: { organizationId, gymMemberId, type: 'NUTRITION', isActive: true },
      orderBy: { startDate: 'desc' },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } }),
  ]);

  // Salonun kendi saat dilimi kullanılmalı — aksi halde farklı bir bölgedeki
  // (Istanbul dışı) bir şubede gece geç saatte girilen bir öğün yanlış güne
  // sayılır (bkz. lib/reports/bucketing.ts'teki aynı yaklaşım/kaynak).
  const timeZone = organization?.timezone ?? 'Europe/Istanbul';

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
    timeZone,
  );

  return {
    days,
    plannedDailyCalories: activeNutritionProgram
      ? sumPlannedCaloriesFromProgramContent(activeNutritionProgram.content)
      : null,
    activeProgramTitle: activeNutritionProgram?.title ?? null,
    timeZone,
  };
}
