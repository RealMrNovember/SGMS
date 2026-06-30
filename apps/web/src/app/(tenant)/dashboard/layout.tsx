import { LicenseStatusBanner } from '@/components/license-status-banner';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
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

  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('common');

  const navItems = [
    { href: '/dashboard', label: t('overview') },
    { href: '/dashboard/members', label: t('members') },
    { href: '/dashboard/plans', label: t('plans') },
    { href: '/dashboard/programs', label: t('programs') },
    { href: '/dashboard/messages', label: t('messages') },
    { href: '/dashboard/pos', label: t('pos') },
    { href: '/dashboard/team', label: t('team') },
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

      <header className="border-b border-[var(--border)] bg-[rgba(17,24,39,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="badge">{tCommon('appName')}</p>
            <h1 className="mt-2 text-lg font-semibold">
              {session.user.organizationName ?? tAuth('noOrganization')}
            </h1>
            <p className="muted text-sm">
              {session.user.name} · {session.user.role ?? tAuth('noRole')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="muted text-sm hover:text-white">
                {item.label}
              </Link>
            ))}
            <LocaleSwitcher />
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button type="submit" className="button px-4 py-2 text-sm">
                {tAuth('logout')}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
