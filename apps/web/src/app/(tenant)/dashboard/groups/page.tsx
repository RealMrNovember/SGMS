import { GroupCreateForm } from '@/components/groups/group-create-form';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz17.groups');

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const groups = await prisma.membershipGroup.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      members: {
        select: { id: true, firstName: true, lastName: true },
      },
      _count: { select: { members: true } },
    },
  });

  const memberIds = groups.flatMap((g) => g.members.map((m) => m.id));
  const checkInCounts =
    memberIds.length > 0
      ? await prisma.checkIn.groupBy({
          by: ['gymMemberId'],
          where: {
            organizationId,
            gymMemberId: { in: memberIds },
            direction: 'ENTRY',
            checkedInAt: { gte: since },
          },
          _count: { id: true },
        })
      : [];

  const checkInByMember = new Map(
    checkInCounts.map((row) => [row.gymMemberId, row._count.id]),
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <GroupCreateForm />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('boardTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {groups.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('empty')}</p>
          ) : (
            groups.map((group) => {
              const memberCount = group._count.members;
              const totalCheckIns = group.members.reduce(
                (sum, m) => sum + (checkInByMember.get(m.id) ?? 0),
                0,
              );
              const usagePct =
                memberCount > 0
                  ? Math.min(100, Math.round((totalCheckIns / (memberCount * 30)) * 100))
                  : 0;

              return (
                <article key={group.id} className="px-6 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="muted text-sm">
                        {t(`types.${group.type}`)} · {memberCount} {t('members')}
                        {group.companyName ? ` · ${group.companyName}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums">{usagePct}%</p>
                      <p className="muted text-xs">{t('usage30d')}</p>
                    </div>
                  </div>
                  {group.members.length > 0 ? (
                    <p className="muted mt-2 text-xs">
                      {group.members
                        .slice(0, 5)
                        .map((m) => `${m.firstName} ${m.lastName}`)
                        .join(', ')}
                      {group.members.length > 5 ? '…' : ''}
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
