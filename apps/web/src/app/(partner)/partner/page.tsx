import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function PartnerDashboardPage() {
  const session = await auth();
  if (!session?.user?.partnerId) {
    redirect('/login');
  }

  const t = await getTranslations('partner');

  const organizations = await prisma.organization.findMany({
    where: { partnerId: session.user.partnerId },
    include: {
      subscriptions: {
        where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      members: {
        where: { role: 'OWNER', isActive: true },
        include: { user: { select: { name: true, email: true } } },
        take: 1,
      },
      _count: { select: { gymMembers: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">{t('dashboardTitle')}</h2>
        <p className="muted mt-2 text-sm leading-6">{t('dashboardSubtitle')}</p>
      </section>

      {organizations.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-medium">{t('empty.title')}</p>
          <p className="muted mt-2 text-sm">{t('empty.subtitle')}</p>
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 font-medium">{t('table.company')}</th>
                  <th className="px-6 py-3 font-medium">{t('table.owner')}</th>
                  <th className="px-6 py-3 font-medium">{t('table.plan')}</th>
                  <th className="px-6 py-3 font-medium">{t('table.members')}</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const subscription = org.subscriptions[0] ?? null;
                  const owner = org.members[0]?.user ?? null;

                  return (
                    <tr key={org.id} className="border-b border-[var(--border)] last:border-none">
                      <td className="px-6 py-4">
                        <p className="font-medium">{org.name}</p>
                        <p className="muted text-xs">{org.slug}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p>{owner?.name ?? '—'}</p>
                        <p className="muted text-xs">{owner?.email ?? org.email ?? '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p>{subscription?.plan.name ?? '—'}</p>
                        <p className="muted text-xs">{subscription?.status ?? '—'}</p>
                      </td>
                      <td className="px-6 py-4">{org._count.gymMembers}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/partner/organizations/${org.id}`}
                          className="button px-4 py-2 text-xs"
                        >
                          {t('table.manage')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
