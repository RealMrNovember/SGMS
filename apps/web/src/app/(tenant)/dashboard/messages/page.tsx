import { ConversationSidebar } from '@/components/conversation-sidebar';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { MessageThreadPanel } from '@/components/message-thread-panel';
import { MessageTypingBar } from '@/components/message-typing-bar';
import { SendMessageForm } from '@/components/send-message-form';
import { auth } from '@/lib/auth';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { intlLocaleFor } from '@/lib/format-locale';
import {
  loadConversationSummaries,
  loadPeerDirectory,
  loadThreadMessages,
  markPeerMessagesRead,
} from '@/lib/messaging/load-messaging';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const { with: withPeerId } = await searchParams;

  const t = await getTranslations('messages');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const { peerMeta, recipients } = await loadPeerDirectory(
    organizationId,
    userId,
    t('recipientAthlete'),
  );

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const orgSettings = parseOrganizationSettings(org?.settings);
  const enableReports = orgSettings.features?.messageReports !== false;

  const conversations = await loadConversationSummaries(organizationId, userId, peerMeta);

  const activePeerId =
    withPeerId &&
    (peerMeta.has(withPeerId) || conversations.some((c) => c.peer.id === withPeerId))
      ? withPeerId
      : undefined;

  let threadMessages: Awaited<ReturnType<typeof loadThreadMessages>> = [];
  let activePeer: { id: string; name: string; subtitle?: string } | null = null;

  if (activePeerId) {
    await markPeerMessagesRead(organizationId, userId, activePeerId);
    threadMessages = await loadThreadMessages(organizationId, userId, activePeerId);

    const fromConversation = conversations.find((c) => c.peer.id === activePeerId)?.peer;
    const fromDirectory = peerMeta.get(activePeerId);
    activePeer = fromConversation ?? (fromDirectory
      ? { id: activePeerId, name: fromDirectory.name, subtitle: fromDirectory.subtitle }
      : null);
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-6">
      <MessageLiveRefresh userId={userId} organizationId={organizationId} />
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 text-sm">
          {totalUnread > 0 ? t('thread.unreadTotal', { count: totalUnread }) : t('subtitle')}
        </p>
      </div>

      <div className="card grid min-h-[560px] overflow-hidden lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className={activePeerId ? 'hidden lg:block' : 'block min-h-0'}>
          <ConversationSidebar
            conversations={conversations}
            activePeerId={activePeerId}
            basePath="/dashboard/messages"
          />
        </div>

        {activePeer && activePeerId ? (
          <div className="flex min-h-0 flex-col">
            <MessageTypingBar
              peerId={activePeerId}
              userId={userId}
              organizationId={organizationId}
            />
            <MessageThreadPanel
              messages={threadMessages}
              currentUserId={userId}
              peer={activePeer}
              dateLocale={dateLocale}
              listHref="/dashboard/messages"
              canCompose
              enableReports={enableReports}
            />
          </div>
        ) : (
          <div className="hidden flex-col items-center justify-center p-8 text-center lg:flex">
            <p className="text-lg font-medium">{t('thread.selectConversation')}</p>
            <p className="muted mt-2 max-w-sm text-sm">{t('thread.selectConversationHint')}</p>
          </div>
        )}
      </div>

      {recipients.length > 0 ? (
        <SendMessageForm recipients={recipients} />
      ) : null}
    </div>
  );
}
