import { AdminSidebarNav } from '@/components/admin/admin-sidebar-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { auth, signOut } from '@/lib/auth';
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

  const navItems = [
    { href: '/admin', label: t('adminOverview'), exact: true },
    { href: '/admin/organizations', label: tAdmin('customers') },
    { href: '/admin/communications', label: tAdmin('communicationsNav') },
    { href: '/admin/audit', label: tAdmin('auditNav') },
    { href: '/admin/organizations/new', label: t('newCustomer') },
  ];

  return (
    <div className="admin-shell min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="admin-sidebar px-5 py-8">
        <div className="mb-10">
          <p className="admin-kicker">{tAuth('adminPlatform')}</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{tAdmin('masterTitle')}</h1>
          <p className="muted mt-2 text-sm leading-6">{tAdmin('masterSubtitle')}</p>
        </div>

        <AdminSidebarNav items={navItems} />

        <div className="mt-10 rounded-xl border border-[var(--admin-gold-muted)] p-4">
          <p className="admin-kicker">{tAuth('session')}</p>
          <p className="mt-2 text-sm font-medium">{session.user.name}</p>
          <p className="muted text-xs">{session.user.email}</p>
          <div className="mt-4">
            <LocaleSwitcher />
          </div>
          <form
            className="mt-4"
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="button w-full px-4 py-2 text-sm">
              {tAuth('logout')}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-screen">
        <header className="border-b border-[var(--admin-gold-muted)] bg-[rgba(15,20,25,0.85)] px-6 py-5 backdrop-blur">
          <p className="admin-kicker">{tAdmin('controlCenter')}</p>
          <p className="muted mt-1 text-sm">{tAuth('platformTagline')}</p>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
