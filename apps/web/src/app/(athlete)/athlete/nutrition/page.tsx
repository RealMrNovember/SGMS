import { NutritionLogPanel } from '@/components/nutrition-log-panel';
import { auth } from '@/lib/auth';
import { getNutritionOverviewForMember } from '@/lib/nutrition/list';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteNutritionPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete.nutrition');
  const tAthlete = await getTranslations('athlete');
  const overview = await getNutritionOverviewForMember(session.user.organizationId, session.user.gymMemberId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {tAthlete('backHome')}
        </Link>
        <h2 className="mt-4 text-xl font-semibold">{t('title')}</h2>
      </div>

      <NutritionLogPanel
        days={overview.days.map((day) => ({
          dateKey: day.dateKey,
          totalCalories: day.totalCalories,
          totalProteinG: day.totalProteinG,
          totalCarbsG: day.totalCarbsG,
          totalFatG: day.totalFatG,
          entryCount: day.entryCount,
          entries: day.entries.map((entry) => ({
            id: entry.id,
            loggedAt: entry.loggedAt.toISOString(),
            mealType: entry.mealType,
            foodName: entry.foodName,
            calories: entry.calories,
            proteinG: entry.proteinG,
            carbsG: entry.carbsG,
            fatG: entry.fatG,
            notes: entry.notes,
          })),
        }))}
        plannedDailyCalories={overview.plannedDailyCalories}
        activeProgramTitle={overview.activeProgramTitle}
      />
    </div>
  );
}
