import { AthleteNav } from '@/components/athlete-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UserAvatar } from '@/components/user-avatar';
import { auth, signOut } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.gymMemberId) {
    redirect('/dashboard');
  }

  const t = await getTranslations('athlete');
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('common');

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[rgba(17,24,39,0.9)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={session.user.name} size="md" />
            <div>
              <p className="badge text-[10px]">{t('badge')}</p>
              <h1 className="text-base font-semibold">{session.user.name}</h1>
              <p className="muted text-xs">{session.user.organizationName ?? tCommon('panel')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button type="submit" className="button px-3 py-2 text-xs">
                {tAuth('logout')}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-24">{children}</main>
      <AthleteNav />
    </div>
  );
}
