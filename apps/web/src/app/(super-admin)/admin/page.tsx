import { AdminBadge } from '@/components/admin/admin-badge';
import { auth } from '@/lib/auth';
import {
  daysUntil,
  formatDateTr,
  formatSubscriptionKind,
  licenseTone,
  organizationTone,
  subscriptionTone,
} from '@/lib/admin/format';
import { getAdminDashboardStats, getRecentOrganizations } from '@/lib/admin/queries';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const tAdmin = await getTranslations('admin');

  const [stats, organizations] = await Promise.all([
    getAdminDashboardStats(),
    getRecentOrganizations(10),
  ]);

  const statCards = [
    { label: tAdmin('statCustomers'), value: stats.organizationCount, href: '/admin/organizations' },
    { label: tAdmin('statTrials'), value: stats.trialingSubscriptions, href: '/admin/organizations?subscription=trial' },
    { label: tAdmin('statPaid'), value: stats.activeSubscriptions, href: '/admin/organizations?subscription=paid' },
    { label: tAdmin('statExpiringTrials'), value: stats.expiringTrials, href: '/admin/organizations?subscription=trial' },
    { label: tAdmin('statLicenseIssues'), value: stats.licenseIssues, href: '/admin/organizations?license=EXPIRED' },
    { label: tAdmin('statNewWeek'), value: stats.newThisWeek, href: '/admin/organizations' },
    { label: tAdmin('statPastDue'), value: stats.pastDue, href: '/admin/organizations?subscription=PAST_DUE' },
    { label: tAdmin('statSuspended'), value: stats.suspendedOrgs, href: '/admin/organizations?status=SUSPENDED' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {params.created ? (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {tAdmin('orgCreatedBanner', { slug: params.created })}
        </section>
      ) : null}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('dashboardTitle')}</h2>
          <p className="muted mt-2 max-w-2xl text-sm leading-6">{tAdmin('dashboardSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/organizations" className="button px-5 py-3 text-sm">
            {tAdmin('viewAllCustomers')}
          </Link>
          <Link href="/admin/organizations/new" className="button button-gold px-5 py-3 text-sm">
            {tAdmin('addCustomer')}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href} className="admin-stat rounded-2xl p-5 transition hover:border-[var(--admin-gold)]">
            <p className="admin-kicker">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{tAdmin('recentCustomers')}</h3>
            <p className="muted mt-1 text-sm">{tAdmin('recentCustomersHint')}</p>
          </div>
          <Link href="/admin/communications" className="button px-4 py-2 text-sm">
            {tAdmin('communicationsNav')}
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{tAdmin('colSalon')}</th>
                <th className="px-6 py-3 font-medium">{tAdmin('colOwner')}</th>
                <th className="px-6 py-3 font-medium">{tAdmin('colBilling')}</th>
                <th className="px-6 py-3 font-medium">{tAdmin('colLicense')}</th>
                <th className="px-6 py-3 font-medium">{tAdmin('colMembers')}</th>
                <th className="px-6 py-3 font-medium">{tAdmin('colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => {
                const subscription = org.subscriptions[0] ?? null;
                const owner = org.members[0]?.user ?? null;
                const trialDays = daysUntil(subscription?.trialEndsAt ?? org.licenseExpiresAt);

                return (
                  <tr key={org.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">
                      <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                      <p className="muted text-xs">{org.slug}</p>
                      <AdminBadge label={org.status} tone={organizationTone(org.status)} />
                    </td>
                    <td className="px-6 py-4">
                      <p>{owner?.name ?? '—'}</p>
                      <p className="muted text-xs">{owner?.email ?? org.email ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <AdminBadge
                        label={formatSubscriptionKind(subscription?.status)}
                        tone={subscriptionTone(subscription?.status)}
                      />
                      {subscription?.status === 'TRIALING' && trialDays !== null ? (
                        <p className="muted mt-1 text-xs">{tAdmin('daysLeft', { count: trialDays })}</p>
                      ) : null}
                      <p className="muted mt-1 text-xs">{subscription?.plan.name ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <AdminBadge label={org.centralLicenseStatus} tone={licenseTone(org.centralLicenseStatus)} />
                      <p className="muted mt-1 text-xs">{formatDateTr(org.licenseExpiresAt)}</p>
                    </td>
                    <td className="px-6 py-4">{org._count.gymMembers}</td>
                    <td className="muted px-6 py-4">{formatDateTr(org.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
