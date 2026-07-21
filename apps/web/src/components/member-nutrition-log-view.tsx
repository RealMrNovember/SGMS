import { getTranslations } from 'next-intl/server';
import type { MealType } from '@sgms/database';

type FoodEntryItem = {
  id: string;
  mealType: MealType;
  foodName: string;
  calories: number | null;
};

type DayItem = {
  dateKey: string;
  totalCalories: number;
  entries: FoodEntryItem[];
};

/**
 * PT/salon tarafındaki **salt-okunur** beslenme günlüğü görünümü — roadmap.md
 * Faz 41'e göre kayıt ekleme/silme yalnızca sporcunun kendisine ait (bkz.
 * `actions/nutrition.ts`).
 */
export async function MemberNutritionLogView({
  days,
  plannedDailyCalories,
  activeProgramTitle,
}: {
  days: DayItem[];
  plannedDailyCalories: number | null;
  activeProgramTitle: string | null;
}) {
  const t = await getTranslations('members.nutrition');
  const tMeal = await getTranslations('athlete.nutrition.mealTypes');

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        {plannedDailyCalories != null ? (
          <span className="badge text-[10px]">
            {t('planned', { calories: plannedDailyCalories })}
            {activeProgramTitle ? ` — ${activeProgramTitle}` : ''}
          </span>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="muted px-6 py-4 text-sm">{t('noEntries')}</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {days.map((day) => (
            <div key={day.dateKey} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{day.dateKey}</p>
                <p className="muted text-xs">{t('dayTotal', { calories: day.totalCalories })}</p>
              </div>
              <ul className="muted mt-2 space-y-1 text-xs">
                {day.entries.map((entry) => (
                  <li key={entry.id}>
                    {tMeal(entry.mealType)} · {entry.foodName}
                    {entry.calories != null ? ` · ${entry.calories} kcal` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
