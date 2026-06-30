import { MessageCompose } from '@/components/message-compose';
import { displayName } from '@/lib/messaging/conversations';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type ThreadMessage = {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  sender: { name: string | null; email: string };
};

export async function MessageThreadPanel({
  messages,
  currentUserId,
  peer,
  dateLocale,
  listHref,
  canCompose,
}: {
  messages: ThreadMessage[];
  currentUserId: string;
  peer: { id: string; name: string; subtitle?: string };
  dateLocale: string;
  listHref: string;
  canCompose: boolean;
}) {
  const t = await getTranslations('messages.thread');

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Link href={listHref} className="muted text-sm hover:text-white lg:hidden">
          ←
        </Link>
        <div className="min-w-0">
          <p className="truncate font-medium">{peer.name}</p>
          {peer.subtitle ? <p className="muted truncate text-xs">{peer.subtitle}</p> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="muted py-12 text-center text-sm">{t('emptyThread')}</p>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? 'rounded-br-md bg-[var(--accent)]/25 text-white'
                      : 'rounded-bl-md border border-[var(--border)] bg-white/[0.04]'
                  }`}
                >
                  {!isMine ? (
                    <p className="muted mb-1 text-[10px]">
                      {displayName(message.sender)}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`mt-1.5 text-[10px] ${isMine ? 'text-white/60' : 'muted'}`}>
                    {message.createdAt.toLocaleString(dateLocale)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canCompose ? (
        <MessageCompose receiverId={peer.id} receiverLabel={peer.name} compact />
      ) : (
        <p className="muted border-t border-[var(--border)] px-4 py-3 text-center text-xs">
          {t('readOnly')}
        </p>
      )}
    </section>
  );
}
