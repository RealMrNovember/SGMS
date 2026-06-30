import { AddMemberForm } from '@/components/add-member-form';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { memberCountryLabel } from '@/lib/member-countries';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const MEMBER_MANAGER_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('members');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [organization, plans, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
    prisma.gymMembershipPlan.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        durationDays: true,
        price: true,
      },
    }),
    prisma.gymMember.findMany({
      where: { organizationId },
      include: { plan: true },
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    }),
  ]);

  const canManage = session.user.role ? MEMBER_MANAGER_ROLES.has(session.user.role) : false;

  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          {t('subtitle', { orgName: organization?.name ?? '—' })}
        </p>
      </div>

      <AddMemberForm canManage={canManage} plans={planOptions} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('listCount', { count: members.length })}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{t('columns.member')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.identity')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.plan')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.status')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.membershipEnd')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.measurements')}</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted px-6 py-8 text-center">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const fullName = `${member.firstName} ${member.lastName}`;
                  return (
                    <tr key={member.id} className="border-b border-[var(--border)] last:border-none">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={fullName}
                            avatarUrl={member.avatarUrl}
                            size="sm"
                          />
                          <div>
                            <Link
                              href={`/dashboard/members/${member.id}`}
                              className="font-medium hover:text-white"
                            >
                              {fullName}
                            </Link>
                            <p className="muted text-xs">{member.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p>
                          {member.isForeignMember
                            ? (member.passportNumber ?? '—')
                            : (member.nationalId ?? '—')}
                        </p>
                        <p className="muted text-xs">
                          {[
                            member.isForeignMember
                              ? memberCountryLabel(member.nationality)
                              : null,
                            member.phone,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">{member.plan?.name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className="badge">{member.status}</span>
                      </td>
                      <td className="muted px-6 py-4">
                        {member.membershipEndsAt
                          ? member.membershipEndsAt.toLocaleDateString(dateLocale)
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/members/${member.id}/measurements`}
                          className="muted text-sm hover:text-white"
                        >
                          {t('viewMeasurements')}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
