import { AthleteGoalPanel } from '@/components/athlete-goal-panel';
import { auth } from '@/lib/auth';
import { listAthleteGoalsWithProgress } from '@/lib/goals/list';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteGoalsPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete.goals');
  const tAthlete = await getTranslations('athlete');
  const goals = await listAthleteGoalsWithProgress(session.user.organizationId, session.user.gymMemberId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {tAthlete('backHome')}
        </Link>
        <h2 className="mt-4 text-xl font-semibold">{t('title')}</h2>
      </div>

      <AthleteGoalPanel
        goals={goals.map((goal) => ({
          id: goal.id,
          createdByType: goal.createdByType,
          targetType: goal.targetType,
          measurementField: goal.measurementField,
          targetValue: goal.targetValue?.toString() ?? null,
          startValue: goal.startValue?.toString() ?? null,
          targetDate: goal.targetDate?.toISOString() ?? null,
          status: goal.status,
          notes: goal.notes,
          progressPercent: goal.progress.progressPercent,
          currentValue: goal.progress.currentValue,
        }))}
      />
    </div>
  );
}
