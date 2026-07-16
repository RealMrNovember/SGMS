import { ConversationSidebar } from '@/components/conversation-sidebar';
import { MessageLiveRefresh } from '@/components/message-live-refresh';
import { MessageThreadPanel } from '@/components/message-thread-panel';
import { MessageTypingBar } from '@/components/message-typing-bar';
import { auth } from '@/lib/auth';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { intlLocaleFor } from '@/lib/format-locale';
import { displayName } from '@/lib/messaging/conversations';
import {
  loadConversationSummaries,
  loadThreadMessages,
  markPeerMessagesRead,
} from '@/lib/messaging/load-messaging';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const { with: withPeerId } = await searchParams;

  const t = await getTranslations('athlete');
  const tMessages = await getTranslations('messages');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const gymMember = await prisma.gymMember.findFirst({
    where: { id: session.user.gymMemberId, organizationId },
    include: {
      trainer: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const orgSettings = parseOrganizationSettings(org?.settings);
  const enableReports = orgSettings.features?.messageReports !== false;

  const peerMeta = new Map<string, { name: string; subtitle?: string; avatarUrl?: string | null }>();

  if (gymMember?.trainer) {
    peerMeta.set(gymMember.trainer.id, {
      name: displayName(gymMember.trainer),
      subtitle: tMessages('thread.roleTrainer'),
      avatarUrl: gymMember.trainer.avatarUrl,
    });
  }

  const conversations = await loadConversationSummaries(organizationId, userId, peerMeta);

  const conversationList = [...conversations];
  if (gymMember?.trainer && !conversationList.some((c) => c.peer.id === gymMember.trainer!.id)) {
    conversationList.unshift({
      peer: {
        id: gymMember.trainer.id,
        name: displayName(gymMember.trainer),
        subtitle: tMessages('thread.roleTrainer'),
        avatarUrl: gymMember.trainer.avatarUrl,
      },
      lastMessage: tMessages('thread.noMessagesYet'),
      lastMessageAt: new Date(0),
      unreadCount: 0,
    });
  }

  const activePeerId =
    withPeerId && peerMeta.has(withPeerId) ? withPeerId : undefined;

  let threadMessages: Awaited<ReturnType<typeof loadThreadMessages>> = [];
  let activePeer: { id: string; name: string; subtitle?: string; avatarUrl?: string | null } | null = null;

  if (activePeerId) {
    await markPeerMessagesRead(organizationId, userId, activePeerId);
    threadMessages = await loadThreadMessages(organizationId, userId, activePeerId);

    const fromConversation = conversations.find((c) => c.peer.id === activePeerId)?.peer;
    const fromDirectory = peerMeta.get(activePeerId);
    activePeer = fromConversation ?? (fromDirectory
      ? { id: activePeerId, name: fromDirectory.name, subtitle: fromDirectory.subtitle, avatarUrl: fromDirectory.avatarUrl }
      : null);
  }

  const totalUnread = conversationList.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="space-y-4">
      <MessageLiveRefresh userId={userId} organizationId={organizationId} />
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {t('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{t('pages.messages')}</h2>
        <p className="muted mt-1 text-sm">
          {totalUnread > 0
            ? t('unreadCount', { count: totalUnread })
            : t('allRead')}
        </p>
      </div>

      <div className="card grid min-h-[calc(100dvh-12rem)] overflow-hidden md:min-h-[520px] lg:grid-cols-[minmax(240px,280px)_1fr]">
        <div className={activePeerId ? 'hidden lg:block' : 'block'}>
          <ConversationSidebar
            conversations={conversationList}
            activePeerId={activePeerId}
            basePath="/athlete/messages"
            backHref="/athlete/messages"
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
              listHref="/athlete/messages"
              canCompose
              enableReports={enableReports}
            />
          </div>
        ) : conversationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="font-medium">{tMessages('thread.noConversations')}</p>
            <p className="muted mt-2 text-sm">{t('noMessages')}</p>
          </div>
        ) : (
          <div className="hidden flex-col items-center justify-center p-8 text-center lg:flex">
            <p className="font-medium">{tMessages('thread.selectConversation')}</p>
            <p className="muted mt-2 text-sm">{tMessages('thread.selectConversationHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
