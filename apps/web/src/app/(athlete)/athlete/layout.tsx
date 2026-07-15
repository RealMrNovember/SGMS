import { AthleteNav } from '@/components/athlete-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { PushNotificationToggle } from '@/components/push-notification-toggle';
import { UserAvatar } from '@/components/user-avatar';
import { auth, signOut } from '@/lib/auth';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.gymMemberId || !session.user.organizationId) {
    redirect('/dashboard');
  }

  const access = await resolveSubscriptionAccess(session.user.organizationId);
  const t = await getTranslations('athlete');
  const tAuth = await getTranslations('auth');
  const tCommon = await getTranslations('common');
  const tBilling = await getTranslations('billing');

  if (access.mode === 'billing_only') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <p className="badge">{t('badge')}</p>
        <h1 className="mt-4 text-xl font-semibold">{tBilling('athleteLockedTitle')}</h1>
        <p className="muted mt-3 max-w-md text-sm leading-7">{tBilling('athleteLockedHint')}</p>
        <form
          className="mt-8"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button type="submit" className="button px-5 py-2.5 text-sm">
            {tAuth('logout')}
          </button>
        </form>
      </div>
    );
  }

  const unreadMessages = await prisma.directMessage.count({
    where: {
      organizationId: session.user.organizationId,
      receiverId: session.user.id,
      isRead: false,
    },
  });

  return (
    <div className="min-h-screen">
      <MessageLiveRefresh
        userId={session.user.id}
        organizationId={session.user.organizationId}
      />
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
            <PushNotificationToggle />
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
      <AthleteNav unreadMessages={unreadMessages} />
    </div>
  );
}
