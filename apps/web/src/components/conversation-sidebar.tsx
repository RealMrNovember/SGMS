import { UserAvatar } from '@/components/user-avatar';
import type { ConversationSummary } from '@/lib/messaging/conversations';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function ConversationSidebar({
  conversations,
  activePeerId,
  basePath,
  backHref,
}: {
  conversations: ConversationSummary[];
  activePeerId?: string;
  basePath: string;
  backHref?: string;
}) {
  const t = await getTranslations('messages.thread');

  return (
    <aside className="flex h-full min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
      <div className="border-b border-[var(--border)] px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            className="muted mb-2 inline-flex items-center gap-1 text-xs hover:text-white lg:hidden"
          >
            <ArrowLeft size={14} aria-hidden="true" /> {t('backToList')}
          </Link>
        ) : null}
        <h3 className="text-sm font-semibold">{t('conversations')}</h3>
        <p className="muted text-xs">{t('conversationCount', { count: conversations.length })}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="muted px-4 py-8 text-center text-sm">{t('noConversations')}</p>
        ) : (
          <ul>
            {conversations.map((conversation) => {
              const isActive = conversation.peer.id === activePeerId;
              const href = `${basePath}?with=${conversation.peer.id}`;
              const preview =
                conversation.lastMessage.length > 72
                  ? `${conversation.lastMessage.slice(0, 72)}…`
                  : conversation.lastMessage;

              return (
                <li key={conversation.peer.id}>
                  <Link
                    href={href}
                    className={`flex gap-3 border-b border-[var(--border)] px-4 py-3 transition hover:bg-white/[0.03] ${
                      isActive ? 'bg-white/[0.05]' : ''
                    }`}
                  >
                    <UserAvatar
                      name={conversation.peer.name}
                      avatarUrl={conversation.peer.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{conversation.peer.name}</p>
                        {conversation.unreadCount > 0 ? (
                          <span className="badge shrink-0 text-[10px]">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      {conversation.peer.subtitle ? (
                        <p className="muted truncate text-[10px]">{conversation.peer.subtitle}</p>
                      ) : null}
                      <p className="muted mt-1 truncate text-xs">{preview}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
