import { AddMemberForm } from '@/components/add-member-form';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { memberCountryLabel } from '@/lib/member-countries';
import { prisma } from '@/lib/prisma';
import type { GymMemberStatus, Prisma } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const MEMBER_MANAGER_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);
const PAGE_SIZE = 25;
const STATUS_FILTERS: GymMemberStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

function isGymMemberStatus(value: unknown): value is GymMemberStatus {
  return typeof value === 'string' && (STATUS_FILTERS as string[]).includes(value);
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('members');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const statusFilter = isGymMemberStatus(params.status) ? params.status : null;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const where: Prisma.GymMemberWhereInput = {
    organizationId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { nationalId: { contains: query, mode: 'insensitive' } },
            { passportNumber: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [organization, plans, totalCount, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
    prisma.gymMembershipPlan.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, durationDays: true, price: true },
    }),
    prisma.gymMember.count({ where }),
    prisma.gymMember.findMany({
      where,
      include: { plan: true },
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeFrom = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(currentPage * PAGE_SIZE, totalCount);

  const canManage = session.user.role ? MEMBER_MANAGER_ROLES.has(session.user.role) : false;

  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
  }));

  function pageHref(targetPage: number) {
    const search = new URLSearchParams();
    if (query) search.set('q', query);
    if (statusFilter) search.set('status', statusFilter);
    if (targetPage > 1) search.set('page', String(targetPage));
    const qs = search.toString();
    return qs ? `/dashboard/members?${qs}` : '/dashboard/members';
  }

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
          <p className="muted mt-1 text-sm">
            {t('listCount', { from: rangeFrom, to: rangeTo, count: totalCount })}
          </p>

          <form method="get" className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t('searchPlaceholder')}
              className="input min-w-[240px] flex-1"
            />
            <select name="status" defaultValue={statusFilter ?? ''} className="input w-auto">
              <option value="">{t('filterAll')}</option>
              <option value="ACTIVE">{t('filterActive')}</option>
              <option value="INACTIVE">{t('filterInactive')}</option>
              <option value="SUSPENDED">{t('filterSuspended')}</option>
            </select>
            <button type="submit" className="button px-4 py-2 text-sm">
              {t('searchButton')}
            </button>
          </form>
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
                    {query || statusFilter ? t('noResults') : t('empty')}
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

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4 text-sm">
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)} className="muted hover:text-white">
                {t('pagination.previous')}
              </Link>
            ) : (
              <span />
            )}
            <span className="muted">{t('pagination.page', { current: currentPage, total: totalPages })}</span>
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)} className="muted hover:text-white">
                {t('pagination.next')}
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
