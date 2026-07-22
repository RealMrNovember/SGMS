import { CreateProgramForm } from '@/components/create-program-form';
import { ToggleProgramButton } from '@/components/toggle-program-button';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const PROGRAM_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'TRAINER']);

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const userId = session.user.id;
  const canManage = role ? PROGRAM_MANAGER_ROLES.has(role) : false;
  const { member: memberFilter } = await searchParams;

  const t = await getTranslations('programs');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [members, trainers, programs] = await Promise.all([
    prisma.gymMember.findMany({
      where: {
        organizationId,
        status: { not: 'INACTIVE' },
        ...(role === 'TRAINER' ? { trainerId: userId } : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 100,
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: ['TRAINER', 'ADMIN', 'OWNER'] },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.trainingProgram.findMany({
      where: {
        organizationId,
        ...(memberFilter ? { gymMemberId: memberFilter } : {}),
        ...(role === 'TRAINER' ? { trainerId: userId } : {}),
      },
      include: {
        gymMember: { select: { firstName: true, lastName: true } },
        trainer: { select: { name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      take: 50,
    }),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.id,
    label: `${m.firstName} ${m.lastName}`,
  }));

  const trainerOptions = trainers.map((tr) => ({
    id: tr.user.id,
    label: tr.user.name ?? tr.user.email,
  }));

  function programTypeLabel(type: string) {
    if (type === 'WORKOUT') return t('types.workout');
    if (type === 'NUTRITION') return t('types.nutrition');
    return type;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{t('subtitle')}</p>
      </div>

      <CreateProgramForm
        canManage={canManage}
        members={memberOptions}
        trainers={trainerOptions}
        showTrainerSelect={role === 'OWNER' || role === 'ADMIN'}
      />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
          <p className="muted mt-1 text-sm">
            {t('listCount', { count: programs.length })}
            {memberFilter ? t('memberFilterActive') : ''}
          </p>
        </div>

        {programs.length === 0 ? (
          <p className="muted px-6 py-8 text-center text-sm md:hidden">{t('empty')}</p>
        ) : (
          <div className="data-card-list p-4 md:hidden">
            {programs.map((p) => (
              <div key={p.id} className="data-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <Link href={`/dashboard/programs?member=${p.gymMemberId}`} className="muted text-xs hover:text-white">
                      {p.gymMember.firstName} {p.gymMember.lastName}
                    </Link>
                  </div>
                  <span className="badge shrink-0">{programTypeLabel(p.type)}</span>
                </div>
                <div className="mt-3">
                  <div className="data-card-row">
                    <span className="data-card-label">{t('columns.trainer')}</span>
                    <span className="data-card-value">{p.trainer.name ?? '—'}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">{t('columns.period')}</span>
                    <span className="data-card-value">
                      {p.startDate.toLocaleDateString(dateLocale)}
                      {p.endDate ? ` → ${p.endDate.toLocaleDateString(dateLocale)}` : ''}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">{t('columns.status')}</span>
                    <span className={`badge ${p.isActive ? '' : 'opacity-50'}`}>
                      {p.isActive ? tCommon('active') : tCommon('inactive')}
                    </span>
                  </div>
                </div>
                {canManage ? (
                  <div className="data-card-actions">
                    <ToggleProgramButton programId={p.id} isActive={p.isActive} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{t('columns.title')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.athlete')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.type')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.trainer')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.period')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.status')}</th>
                {canManage ? (
                  <th className="px-6 py-3 font-medium">{tCommon('action')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted px-6 py-8 text-center">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                programs.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4 font-medium">{p.title}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/programs?member=${p.gymMemberId}`}
                        className="hover:text-white"
                      >
                        {p.gymMember.firstName} {p.gymMember.lastName}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge">{programTypeLabel(p.type)}</span>
                    </td>
                    <td className="muted px-6 py-4">{p.trainer.name ?? '—'}</td>
                    <td className="muted px-6 py-4">
                      {p.startDate.toLocaleDateString(dateLocale)}
                      {p.endDate ? ` → ${p.endDate.toLocaleDateString(dateLocale)}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${p.isActive ? '' : 'opacity-50'}`}>
                        {p.isActive ? tCommon('active') : tCommon('inactive')}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-6 py-4">
                        <ToggleProgramButton programId={p.id} isActive={p.isActive} />
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
