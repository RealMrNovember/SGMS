import { MarkReadButton } from '@/components/mark-read-button';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteMessagesPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('athlete');
  const tMessages = await getTranslations('messages');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const messages = await prisma.directMessage.findMany({
    where: {
      organizationId: session.user.organizationId,
      receiverId: session.user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { sender: { select: { name: true, email: true } } },
  });

  const unreadCount = messages.filter((message) => !message.isRead).length;

  return (
    <div className="space-y-6">
      <MessageLiveRefresh />
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {t('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{t('pages.messages')}</h2>
        <p className="muted mt-1 text-sm">
          {unreadCount > 0
            ? t('unreadCount', { count: unreadCount })
            : t('allRead')}
        </p>
      </div>

      {messages.length === 0 ? (
        <section className="card p-5">
          <p className="muted text-sm">{t('noMessages')}</p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {messages.map((message) => (
              <article key={message.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {message.sender.name ?? message.sender.email ?? '—'}
                    </p>
                    <p className="muted mt-1 text-xs">
                      {message.createdAt.toLocaleString(dateLocale)}
                      {!message.isRead ? (
                        <span className="ml-2 badge text-[10px]">{tMessages('unread')}</span>
                      ) : null}
                    </p>
                  </div>
                  {!message.isRead ? <MarkReadButton messageId={message.id} /> : null}
                </div>
                <p className="muted mt-3 whitespace-pre-wrap text-sm">{message.content}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
