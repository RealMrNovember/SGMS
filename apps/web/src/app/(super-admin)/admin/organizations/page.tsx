import { AdminBadge } from '@/components/admin/admin-badge';
import { OrganizationFilters } from '@/components/admin/organization-filters';
import { auth } from '@/lib/auth';
import {
  daysUntil,
  formatDateTr,
  formatSubscriptionKind,
  licenseTone,
  organizationTone,
  subscriptionTone,
} from '@/lib/admin/format';
import { countOrganizations, listOrganizations, type OrganizationListFilters } from '@/lib/admin/queries';
import type { CentralLicenseStatus, OrganizationStatus, SubscriptionStatus } from '@sgms/database';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

function parseFilters(searchParams: Record<string, string | undefined>): OrganizationListFilters {
  const filters: OrganizationListFilters = {};

  if (searchParams.q) filters.q = searchParams.q;

  const status = searchParams.status;
  if (status && ['ACTIVE', 'PENDING', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    filters.status = status as OrganizationStatus;
  }

  const subscription = searchParams.subscription;
  if (subscription === 'trial' || subscription === 'paid') {
    filters.subscription = subscription;
  } else if (subscription && ['TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELED'].includes(subscription)) {
    filters.subscription = subscription as SubscriptionStatus;
  }

  const license = searchParams.license;
  if (license && ['TRIAL', 'ACTIVE', 'EXPIRED', 'REVOKED', 'UNKNOWN'].includes(license)) {
    filters.license = license as CentralLicenseStatus;
  }

  return filters;
}

async function OrganizationsTable({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const tAdmin = await getTranslations('admin');
  const filters = parseFilters(searchParams);
  const [organizations, total] = await Promise.all([
    listOrganizations(filters, 100),
    countOrganizations(filters),
  ]);

  if (organizations.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-lg font-medium">{tAdmin('noCustomers')}</p>
        <p className="muted mt-2 text-sm">{tAdmin('noCustomersHint')}</p>
        <Link href="/admin/organizations/new" className="button button-gold mt-6 inline-flex px-5 py-3 text-sm">
          {tAdmin('addCustomer')}
        </Link>
      </div>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <p className="muted text-sm">{tAdmin('customerCount', { count: total })}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-6 py-3 font-medium">{tAdmin('colSalon')}</th>
              <th className="px-6 py-3 font-medium">{tAdmin('colOwner')}</th>
              <th className="px-6 py-3 font-medium">{tAdmin('colBilling')}</th>
              <th className="px-6 py-3 font-medium">{tAdmin('colLicense')}</th>
              <th className="px-6 py-3 font-medium">{tAdmin('colUsage')}</th>
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
                    <div className="mt-2">
                      <AdminBadge label={org.status} tone={organizationTone(org.status)} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p>{owner?.name ?? '—'}</p>
                    <a href={`mailto:${owner?.email ?? org.email ?? ''}`} className="muted text-xs hover:underline">
                      {owner?.email ?? org.email ?? '—'}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <AdminBadge
                      label={formatSubscriptionKind(subscription?.status)}
                      tone={subscriptionTone(subscription?.status)}
                    />
                    <p className="mt-1 text-xs">{subscription?.plan.name ?? '—'}</p>
                    {subscription?.status === 'TRIALING' && trialDays !== null ? (
                      <p className="muted text-xs">{tAdmin('daysLeft', { count: trialDays })}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <AdminBadge label={org.centralLicenseStatus} tone={licenseTone(org.centralLicenseStatus)} />
                    <p className="muted mt-1 text-xs">{formatDateTr(org.licenseExpiresAt)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p>{org._count.gymMembers} üye</p>
                    <p className="muted text-xs">
                      {org._count.members} kullanıcı · {org._count.devices} cihaz
                    </p>
                  </td>
                  <td className="muted px-6 py-4">{formatDateTr(org.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const tAdmin = await getTranslations('admin');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('customersTitle')}</h2>
          <p className="muted mt-2 max-w-2xl text-sm leading-6">{tAdmin('customersSubtitle')}</p>
        </div>
        <Link href="/admin/organizations/new" className="button button-gold px-5 py-3 text-sm">
          {tAdmin('addCustomer')}
        </Link>
      </section>

      <Suspense fallback={<div className="card p-6 text-sm">Filtreler yükleniyor…</div>}>
        <OrganizationFilters />
      </Suspense>

      <Suspense fallback={<div className="card p-6 text-sm">Müşteriler yükleniyor…</div>}>
        <OrganizationsTable searchParams={params} />
      </Suspense>
    </div>
  );
}
