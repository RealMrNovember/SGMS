import { performSignOut } from '@/actions/sign-out';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { PushNotificationToggle } from '@/components/push-notification-toggle';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[rgba(17,24,39,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="badge">{t('badge')}</p>
            <h1 className="mt-2 text-lg font-semibold">{session.user.name}</h1>
            <p className="muted text-sm">{session.user.email}</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/partner" className="muted text-sm hover:text-white">
              {t('nav.dashboard')}
            </Link>
            <PushNotificationToggle />
            <LocaleSwitcher />
            <form
              action={async () => {
                'use server';
                await performSignOut('/login');
              }}
            >
              <button type="submit" className="button px-4 py-2 text-sm">
                {tAuth('logout')}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
