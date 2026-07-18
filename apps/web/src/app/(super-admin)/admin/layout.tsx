import { performSignOut } from '@/actions/sign-out';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSidebarNav, type AppNavGroup } from '@/components/app-sidebar-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { auth } from '@/lib/auth';
import { getMasterAdminStats } from '@/lib/admin/master-admin-queries';
import {
  Building2,
  CreditCard,
  Flag,
  Handshake,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  PlusCircle,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.isSuperAdmin) {
    redirect('/dashboard');
  }

  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const tAdmin = await getTranslations('admin');

  const masterStats = await getMasterAdminStats();

  const navGroups: AppNavGroup[] = [
    {
      title: tAdmin('navGroupPlatform'),
      items: [
        { href: '/admin', label: t('adminOverview'), icon: <LayoutDashboard />, exact: true },
        { href: '/admin/organizations', label: tAdmin('customers'), icon: <Building2 /> },
        { href: '/admin/plans', label: tAdmin('plansNav'), icon: <Layers /> },
        { href: '/admin/partners', label: tAdmin('partnersNav'), icon: <Handshake /> },
      ],
    },
    {
      title: tAdmin('navGroupSecurity'),
      items: [
        { href: '/admin/audit', label: tAdmin('auditNav'), icon: <ScrollText /> },
        { href: '/admin/audit?category=security', label: tAdmin('auditSecurityNav'), icon: <ShieldAlert /> },
        { href: '/admin/moderation', label: tAdmin('moderationNav'), icon: <Flag /> },
        { href: '/admin/account/security', label: tAdmin('twoFactorNav'), icon: <ShieldCheck /> },
      ],
    },
    {
      title: tAdmin('navGroupSystem'),
      items: [
        { href: '/admin/admins', label: tAdmin('adminsNav'), icon: <UserCog /> },
        { href: '/admin/payments', label: tAdmin('paymentsNav'), icon: <CreditCard /> },
        { href: '/admin/communications', label: tAdmin('communicationsNav'), icon: <Mail /> },
        { href: '/admin/organizations/new', label: t('newCustomer'), icon: <PlusCircle /> },
      ],
    },
  ];

  const primaryMobileItems = [
    { href: '/admin', label: t('adminOverview'), icon: <LayoutDashboard />, exact: true },
    { href: '/admin/organizations', label: tAdmin('customers'), icon: <Building2 /> },
    { href: '/admin/audit', label: tAdmin('auditNav'), icon: <ScrollText /> },
    { href: '/admin/moderation', label: tAdmin('moderationNav'), icon: <Flag /> },
  ];

  const logoutAction = async () => {
    'use server';
    await performSignOut('/login');
  };

  return (
    <div className="admin-shell app-shell">
      <aside className="app-sidebar admin-sidebar">
        <div className="app-sidebar-brand">
          <span aria-hidden="true">👑</span>
          <span className="app-sidebar-brand-text">
            <p className="admin-kicker">{tAuth('adminPlatform')}</p>
            <p className="mt-1 text-sm font-semibold">{tAdmin('masterTitle')}</p>
          </span>
        </div>

        <AppSidebarNav groups={navGroups} />

        <div className="app-sidebar-footer space-y-3">
          <div className="app-sidebar-label px-1">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
            <p className="muted truncate text-xs">{session.user.email}</p>
            <p className="mt-2 text-xs text-[var(--gold)]">
              {tAdmin('masterAdminCount', { count: masterStats.active })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
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
          <p className="min-w-0 truncate text-sm font-semibold">{tAdmin('controlCenter')}</p>
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

        <header className="hidden border-b border-[var(--admin-gold-muted)] bg-[rgba(15,20,25,0.85)] px-6 py-5 backdrop-blur lg:block">
          <p className="admin-kicker">{tAdmin('controlCenter')}</p>
          <p className="muted mt-1 text-sm">{tAuth('platformTagline')}</p>
        </header>
        <main className="px-4 py-8 sm:px-6">{children}</main>
      </div>

      <AppBottomNav primaryItems={primaryMobileItems} groups={navGroups} />
    </div>
  );
}
