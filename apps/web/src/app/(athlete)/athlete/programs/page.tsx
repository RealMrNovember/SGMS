import { InteractiveWorkoutView } from '@/components/interactive-workout-view';
import { ProgramContentView } from '@/components/program-content-view';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { normalizeProgramContent } from '@/lib/program-content';
import { getTodayProgressMap } from '@/lib/program-progress';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteProgramsPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const gymMemberId = session.user.gymMemberId;

  const t = await getTranslations('athlete');
  const tPrograms = await getTranslations('programs');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const programs = await prisma.trainingProgram.findMany({
    where: {
      organizationId,
      gymMemberId,
    },
    include: {
      trainer: { select: { name: true, email: true } },
    },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    take: 50,
  });

  const progressMaps = new Map<string, Record<string, { completedSets: number; weightUsed: number | null }>>();
  await Promise.all(
    programs
      .filter((p) => p.isActive && p.type === 'WORKOUT')
      .map(async (p) => {
        progressMaps.set(p.id, await getTodayProgressMap(organizationId, gymMemberId, p.id));
      }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {t('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{t('pages.programs')}</h2>
        <p className="muted mt-1 text-sm">{t('programsCount', { count: programs.length })}</p>
      </div>

      {programs.length === 0 ? (
        <section className="card p-5">
          <p className="muted text-sm">{t('noPrograms')}</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {programs.map((program) => {
              const isInteractive = program.isActive && program.type === 'WORKOUT';
              const normalizedContent = isInteractive
                ? normalizeProgramContent(program.content, program.type)
                : null;
              return (
              <article key={program.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{program.title}</p>
                  <span className={`badge shrink-0 text-[10px] ${program.isActive ? '' : 'opacity-60'}`}>
                    {program.isActive ? t('statusActive') : t('statusInactive')}
                  </span>
                </div>
                <p className="muted mt-2 text-xs">
                  {program.type === 'WORKOUT' ? tPrograms('types.workout') : tPrograms('types.nutrition')} ·{' '}
                  {program.startDate.toLocaleDateString(dateLocale)}
                  {program.endDate
                    ? ` – ${program.endDate.toLocaleDateString(dateLocale)}`
                    : ''}
                </p>
                <p className="muted mt-2 text-xs">
                  {t('trainer')}: {program.trainer?.name ?? program.trainer?.email ?? t('noTrainer')}
                </p>
                {isInteractive && normalizedContent ? (
                  <InteractiveWorkoutView
                    trainingProgramId={program.id}
                    days={normalizedContent.days ?? []}
                    goal={normalizedContent.goal}
                    initialProgress={progressMaps.get(program.id) ?? {}}
                  />
                ) : (
                  <ProgramContentView content={program.content} type={program.type} />
                )}
              </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
