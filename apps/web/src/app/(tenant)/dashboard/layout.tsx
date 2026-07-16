import { performSignOut } from '@/actions/sign-out';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSidebarNav, type AppNavGroup } from '@/components/app-sidebar-nav';
import { LicenseStatusBanner } from '@/components/license-status-banner';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { PushNotificationToggle } from '@/components/push-notification-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { auth } from '@/lib/auth';
import { isBillingPath, resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Dumbbell,
  IdCard,
  LayoutDashboard,
  LogOut,
  Layers,
  MessageSquare,
  ScanLine,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
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
  const tComingSoon = await getTranslations('comingSoon');

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
  const canViewEnterprise = session.user.isHierarchyMember === true;

  const comingSoonItems = locked
    ? []
    : (
        ['hr', 'equipment', 'cashShifts', 'notifications', 'insights'] as const
      ).map((feature) => ({
        href: `/dashboard/coming-soon/${feature}`,
        label: tComingSoon(`features.${feature}.title`),
        icon: Sparkles,
      }));

  const navGroups: AppNavGroup[] = locked
    ? [{ items: [{ href: '/dashboard/billing', label: tBilling('nav'), icon: Wallet, exact: true }] }]
    : [
        {
          items: [{ href: '/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true }],
        },
        {
          title: t('groups.dailyOps'),
          items: [
            { href: '/dashboard/check-in', label: t('checkIn'), icon: ScanLine },
            { href: '/dashboard/members', label: t('members'), icon: Users },
            { href: '/dashboard/pos', label: t('pos'), icon: CreditCard },
            { href: '/dashboard/messages', label: t('messages'), icon: MessageSquare, badge: unreadMessages },
          ],
        },
        {
          title: t('groups.management'),
          items: [
            { href: '/dashboard/programs', label: t('programs'), icon: ClipboardList },
            { href: '/dashboard/trainers', label: t('trainers'), icon: Dumbbell },
            { href: '/dashboard/team', label: t('team'), icon: IdCard },
            { href: '/dashboard/plans', label: t('plans'), icon: Layers },
            { href: '/dashboard/settings', label: t('settings'), icon: Settings },
          ],
        },
        ...(canViewReports || canViewEnterprise
          ? [
              {
                title: t('groups.analytics'),
                items: [
                  ...(canViewReports ? [{ href: '/dashboard/reports', label: t('reports'), icon: BarChart3 }] : []),
                  ...(canViewEnterprise
                    ? [{ href: '/dashboard/enterprise', label: t('enterprise'), icon: Building2 }]
                    : []),
                ],
              },
            ]
          : []),
        {
          items: [{ href: '/dashboard/billing', label: tBilling('nav'), icon: Wallet }, ...comingSoonItems],
        },
      ];

  const primaryMobileItems = locked
    ? navGroups[0].items
    : [
        { href: '/dashboard', label: t('overview'), icon: LayoutDashboard, exact: true },
        { href: '/dashboard/check-in', label: t('checkIn'), icon: ScanLine },
        { href: '/dashboard/members', label: t('members'), icon: Users },
        { href: '/dashboard/pos', label: t('pos'), icon: CreditCard },
      ];

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      centralLicenseStatus: true,
      licenseExpiresAt: true,
      status: true,
      lastLicenseCheckAt: true,
    },
  });

  const logoutAction = async () => {
    'use server';
    await performSignOut('/login');
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span aria-hidden="true">🏋️</span>
          <span className="app-sidebar-brand-text min-w-0">
            <span className="block truncate text-sm font-semibold">
              {session.user.organizationName ?? tAuth('noOrganization')}
            </span>
            <span className="badge mt-1 inline-flex text-[10px]">{tCommon('appName')}</span>
          </span>
        </div>

        <AppSidebarNav groups={navGroups} />

        <div className="app-sidebar-footer space-y-3">
          <div className="app-sidebar-label px-1">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
            <p className="muted truncate text-xs">{session.user.role ?? tAuth('noRole')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
            <PushNotificationToggle />
          </div>
          <form action={logoutAction}>
            <button type="submit" className="button w-full py-2 text-sm">
              {tAuth('logout')}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-screen">
        <div className="app-topbar items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold">
            {session.user.organizationName ?? tAuth('noOrganization')}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
            <form action={logoutAction}>
              <button type="submit" aria-label={tAuth('logout')} className="icon-btn">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>

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

        {!locked ? <MessageLiveRefresh userId={session.user.id} organizationId={session.user.organizationId} /> : null}

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>

      <AppBottomNav primaryItems={primaryMobileItems} groups={navGroups} />
    </div>
  );
}
