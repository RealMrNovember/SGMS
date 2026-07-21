import type { MealType } from '@sgms/database';

export type FoodLogEntryLike = {
  id: string;
  loggedAt: Date;
  mealType: MealType;
  foodName: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  photoUrl: string | null;
};

export type DailyNutritionSummary = {
  /** YYYY-MM-DD, salonun kendi saat diliminde (bkz. `lib/reports/bucketing.ts`'teki aynı yaklaşım) */
  dateKey: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  entryCount: number;
  entries: FoodLogEntryLike[];
};

function dateKeyOf(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Yemek kayıtlarını güne göre gruplar ve her gün için toplamları hesaplar.
 * Ayrı bir "günlük özet" tablosu tutulmaz — bu fonksiyon her okumada sorgu
 * sonucundan saf (yan etkisiz) şekilde toplar (bkz. roadmap.md Faz 41).
 */
export function groupFoodLogEntriesByDay(
  entries: FoodLogEntryLike[],
  timeZone = 'Europe/Istanbul',
): DailyNutritionSummary[] {
  const byDate = new Map<string, DailyNutritionSummary>();

  for (const entry of entries) {
    const dateKey = dateKeyOf(entry.loggedAt, timeZone);
    const bucket = byDate.get(dateKey) ?? {
      dateKey,
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
      entryCount: 0,
      entries: [],
    };
    bucket.totalCalories += entry.calories ?? 0;
    bucket.totalProteinG += entry.proteinG ?? 0;
    bucket.totalCarbsG += entry.carbsG ?? 0;
    bucket.totalFatG += entry.fatG ?? 0;
    bucket.entryCount += 1;
    bucket.entries.push(entry);
    byDate.set(dateKey, bucket);
  }

  return Array.from(byDate.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * `TrainingProgram.content` (ProgramType.NUTRITION) içindeki öğünlerin kalori
 * alanlarını toplar — "plan vs. gerçekleşen" karşılaştırması için PT'nin
 * belirlediği günlük hedef kalori (bkz. roadmap.md Faz 41, `lib/program-content.ts`).
 * Hiçbir öğünde kalori girilmemişse `null` döner (hedef belirlenmemiş demektir).
 */
export function sumPlannedCaloriesFromProgramContent(content: unknown): number | null {
  if (typeof content !== 'object' || content === null) {
    return null;
  }
  const obj = content as Record<string, unknown>;
  if (!Array.isArray(obj.meals)) {
    return null;
  }

  let total = 0;
  let hasAny = false;
  for (const mealRaw of obj.meals) {
    if (typeof mealRaw !== 'object' || mealRaw === null) continue;
    const meal = mealRaw as Record<string, unknown>;
    if (typeof meal.calories === 'number' && Number.isFinite(meal.calories)) {
      total += meal.calories;
      hasAny = true;
    }
  }

  return hasAny ? total : null;
}
