import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Sistem Özeti', exact: true },
  { href: '/admin/organizations/new', label: 'Yeni Müşteri' },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.isSuperAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="admin-shell min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="admin-sidebar px-5 py-8">
        <div className="mb-10">
          <p className="admin-kicker">CiCiByte Platform</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">System Management</h1>
          <p className="muted mt-2 text-sm leading-6">
            GYM firmalarını ve SaaS kiracılarını merkezi olarak yönetin.
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-10 rounded-xl border border-[var(--admin-gold-muted)] p-4">
          <p className="admin-kicker">Oturum</p>
          <p className="mt-2 text-sm font-medium">{session.user.name}</p>
          <p className="muted text-xs">{session.user.email}</p>
          <form
            className="mt-4"
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="button w-full px-4 py-2 text-sm">
              Çıkış
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-screen">
        <header className="border-b border-[var(--admin-gold-muted)] bg-[rgba(15,20,25,0.85)] px-6 py-5 backdrop-blur">
          <p className="admin-kicker">Super Admin</p>
          <p className="muted mt-1 text-sm">Multi-tenant B2B SaaS kontrol merkezi</p>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
