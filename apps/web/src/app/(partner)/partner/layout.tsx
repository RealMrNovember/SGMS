import { performSignOut } from '@/actions/sign-out';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSidebarNav, type AppNavGroup } from '@/components/app-sidebar-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { PushNotificationToggle } from '@/components/push-notification-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { auth } from '@/lib/auth';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.isPartner) {
    redirect('/dashboard');
  }

  const t = await getTranslations('partner');
  const tAuth = await getTranslations('auth');

  const navGroups: AppNavGroup[] = [
    {
      items: [{ href: '/partner', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true }],
    },
  ];

  const logoutAction = async () => {
    'use server';
    await performSignOut('/login');
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span aria-hidden="true">🤝</span>
          <span className="app-sidebar-brand-text">
            <span className="badge">{t('badge')}</span>
          </span>
        </div>

        <AppSidebarNav groups={navGroups} />

        <div className="app-sidebar-footer space-y-3">
          <div className="app-sidebar-label px-1">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
            <p className="muted truncate text-xs">{session.user.email}</p>
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
          <p className="min-w-0 truncate text-sm font-semibold">{t('badge')}</p>
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

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>

      <AppBottomNav primaryItems={navGroups[0].items} groups={navGroups} />
    </div>
  );
}
