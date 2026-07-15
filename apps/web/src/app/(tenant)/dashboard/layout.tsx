import { performSignOut } from '@/actions/sign-out';
import { DashboardNav } from '@/components/dashboard-nav';
import { LicenseStatusBanner } from '@/components/license-status-banner';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { auth } from '@/lib/auth';
import { isBillingPath, resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function TenantDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.isSuperAdmin) {
    redirect('/admin');
  }

  if (!session.user.organizationId) {
    redirect('/login');
  }

  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? headerStore.get('x-invoke-path') ?? '';
  const access = await resolveSubscriptionAccess(session.user.organizationId);

  if (access.mode === 'billing_only' && pathname && !isBillingPath(pathname)) {
    redirect('/dashboard/billing');
  }

  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('common');
  const tBilling = await getTranslations('billing');

  const locked = access.mode === 'billing_only';

  const unreadMessages = locked
    ? 0
    : await prisma.directMessage.count({
        where: {
          organizationId: session.user.organizationId,
          receiverId: session.user.id,
          isRead: false,
        },
      });

  const canViewReports = session.user.role === 'OWNER' || session.user.role === 'ADMIN';

  const navItems = locked
    ? [{ href: '/dashboard/billing', label: tBilling('nav') }]
    : [
        { href: '/dashboard', label: t('overview') },
        { href: '/dashboard/members', label: t('members') },
        { href: '/dashboard/plans', label: t('plans') },
        { href: '/dashboard/programs', label: t('programs') },
        { href: '/dashboard/trainers', label: t('trainers') },
        { href: '/dashboard/messages', label: t('messages'), badge: unreadMessages },
        { href: '/dashboard/check-in', label: t('checkIn') },
        { href: '/dashboard/pos', label: t('pos') },
        ...(canViewReports ? [{ href: '/dashboard/reports', label: t('reports') }] : []),
        { href: '/dashboard/team', label: t('team') },
        { href: '/dashboard/settings', label: t('settings') },
        { href: '/dashboard/billing', label: tBilling('nav') },
      ];

  const tComingSoon = await getTranslations('comingSoon');
  const comingSoonItems = locked
    ? []
    : (
        ['hr', 'equipment', 'cashShifts', 'notifications', 'insights'] as const
      ).map((feature) => ({
        href: `/dashboard/coming-soon/${feature}`,
        label: tComingSoon(`features.${feature}.title`),
      }));

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      centralLicenseStatus: true,
      licenseExpiresAt: true,
      status: true,
      lastLicenseCheckAt: true,
    },
  });

  return (
    <div className="min-h-screen">
      {organization ? (
        <LicenseStatusBanner
          status={organization.centralLicenseStatus}
          licenseExpiresAt={organization.licenseExpiresAt}
          organizationStatus={organization.status}
          lastLicenseCheckAt={organization.lastLicenseCheckAt}
        />
      ) : null}

      {locked ? (
        <div className="border-b border-rose-500/40 bg-rose-950/40 px-6 py-3 text-center text-sm text-rose-100">
          {tBilling('layoutLockBanner')}{' '}
          <Link href="/dashboard/billing" className="underline">
            {tBilling('nav')}
          </Link>
        </div>
      ) : null}

      {!locked ? (
        <MessageLiveRefresh
          userId={session.user.id}
          organizationId={session.user.organizationId}
        />
      ) : null}

      <header className="border-b border-[var(--border)] bg-[rgba(17,24,39,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="badge">{tCommon('appName')}</p>
            <h1 className="mt-2 truncate text-lg font-semibold">
              {session.user.organizationName ?? tAuth('noOrganization')}
            </h1>
            <p className="muted truncate text-sm">
              {session.user.name} · {session.user.role ?? tAuth('noRole')}
            </p>
          </div>

          <DashboardNav
            navItems={navItems}
            comingSoonItems={comingSoonItems}
            comingSoonGroupLabel={t('comingSoonGroup')}
            logoutLabel={tAuth('logout')}
            logoutAction={async () => {
              'use server';
              await performSignOut('/login');
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
