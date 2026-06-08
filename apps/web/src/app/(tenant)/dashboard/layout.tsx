import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Özet' },
  { href: '/dashboard/members', label: 'Üyeler' },
  { href: '/dashboard/team', label: 'Personel' },
];

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

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[rgba(17,24,39,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="badge">CiCiByte SGMS</p>
            <h1 className="mt-2 text-lg font-semibold">
              {session.user.organizationName ?? 'Organizasyon seçilmedi'}
            </h1>
            <p className="muted text-sm">
              {session.user.name} · {session.user.role ?? 'Rol yok'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="muted text-sm hover:text-white">
                {item.label}
              </Link>
            ))}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button type="submit" className="button px-4 py-2 text-sm">
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
