import { MarkReadButton } from '@/components/mark-read-button';
import { SendMessageForm } from '@/components/send-message-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const { box: boxParam } = await searchParams;
  const box = boxParam === 'sent' ? 'sent' : 'inbox';

  const [staffMembers, athleteMembers, messages] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, userId: { not: userId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.gymMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        AND: [{ userId: { not: null } }, { userId: { not: userId } }],
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    box === 'sent'
      ? prisma.directMessage.findMany({
          where: { organizationId, senderId: userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { receiver: { select: { name: true, email: true } } },
        })
      : prisma.directMessage.findMany({
          where: { organizationId, receiverId: userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { sender: { select: { name: true, email: true } } },
        }),
  ]);

  const recipientMap = new Map<string, string>();

  for (const m of staffMembers) {
    recipientMap.set(
      m.user.id,
      `${m.user.name ?? m.user.email} (${m.role})`,
    );
  }

  for (const a of athleteMembers) {
    if (a.user) {
      recipientMap.set(a.user.id, `${a.user.name ?? a.user.email} (Sporcu)`);
    }
  }

  const recipients = [...recipientMap.entries()].map(([id, label]) => ({ id, label }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          ← Özet
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">Mesajlar</h2>
        <p className="muted mt-2 text-sm">Gelen ve giden mesajlar.</p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/dashboard/messages"
          className={box === 'inbox' ? 'text-white' : 'muted hover:text-white'}
        >
          Gelen Kutusu
        </Link>
        <Link
          href="/dashboard/messages?box=sent"
          className={box === 'sent' ? 'text-white' : 'muted hover:text-white'}
        >
          Giden
        </Link>
      </div>

      <SendMessageForm recipients={recipients} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">
            {box === 'sent' ? 'Giden Mesajlar' : 'Gelen Kutusu'}
          </h3>
          <p className="muted mt-1 text-sm">{messages.length} mesaj</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {messages.length === 0 ? (
            <p className="muted px-6 py-8 text-center text-sm">Henüz mesaj yok.</p>
          ) : (
            messages.map((msg) => {
              const peer =
                box === 'sent'
                  ? ('receiver' in msg ? msg.receiver : null)
                  : ('sender' in msg ? msg.sender : null);
              const peerLabel = peer?.name ?? peer?.email ?? '—';

              return (
                <article key={msg.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {box === 'sent' ? `→ ${peerLabel}` : `← ${peerLabel}`}
                      </p>
                      <p className="muted text-xs">
                        {msg.createdAt.toLocaleString('tr-TR')}
                        {!msg.isRead && box === 'inbox' ? ' · Okunmadı' : ''}
                      </p>
                    </div>
                    {box === 'inbox' && !msg.isRead ? (
                      <MarkReadButton messageId={msg.id} />
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
