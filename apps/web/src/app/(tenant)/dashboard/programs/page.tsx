import { CreateProgramForm } from '@/components/create-program-form';
import { ToggleProgramButton } from '@/components/toggle-program-button';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
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

  const [members, trainers, programs] = await Promise.all([
    prisma.gymMember.findMany({
      where: { organizationId, status: { not: 'INACTIVE' } },
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

  const trainerOptions = trainers.map((t) => ({
    id: t.user.id,
    label: t.user.name ?? t.user.email,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          ← Özet
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">Antrenman & Beslenme Programları</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          PT program atamaları ve sporcu bazlı filtreleme.
        </p>
      </div>

      <CreateProgramForm
        canManage={canManage}
        members={memberOptions}
        trainers={trainerOptions}
        showTrainerSelect={role === 'OWNER' || role === 'ADMIN'}
      />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Program Listesi</h3>
          <p className="muted mt-1 text-sm">
            {programs.length} kayıt
            {memberFilter ? ' · sporcu filtresi aktif' : ''}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">Başlık</th>
                <th className="px-6 py-3 font-medium">Sporcu</th>
                <th className="px-6 py-3 font-medium">Tür</th>
                <th className="px-6 py-3 font-medium">Antrenör</th>
                <th className="px-6 py-3 font-medium">Dönem</th>
                <th className="px-6 py-3 font-medium">Durum</th>
                {canManage ? <th className="px-6 py-3 font-medium">İşlem</th> : null}
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted px-6 py-8 text-center">
                    Henüz program yok.
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
                      <span className="badge">{p.type}</span>
                    </td>
                    <td className="muted px-6 py-4">{p.trainer.name ?? '—'}</td>
                    <td className="muted px-6 py-4">
                      {p.startDate.toLocaleDateString('tr-TR')}
                      {p.endDate ? ` → ${p.endDate.toLocaleDateString('tr-TR')}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${p.isActive ? '' : 'opacity-50'}`}>
                        {p.isActive ? 'Aktif' : 'Pasif'}
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
