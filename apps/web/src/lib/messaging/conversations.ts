export type PeerProfile = {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
};

export type ConversationSummary = {
  peer: PeerProfile;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
  senderId: string;
  receiverId: string;
  sender: { id: string; name: string | null; email: string; avatarUrl: string | null };
  receiver: { id: string; name: string | null; email: string; avatarUrl: string | null };
};

export function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email;
}

export function buildConversationSummaries(
  messages: MessageRow[],
  currentUserId: string,
  peerMeta: Map<string, Omit<PeerProfile, 'id'>>,
): ConversationSummary[] {
  const byPeer = new Map<string, ConversationSummary>();

  for (const message of messages) {
    const isIncoming = message.receiverId === currentUserId;
    const peerUser = isIncoming ? message.sender : message.receiver;
    const peerId = peerUser.id;

    const meta = peerMeta.get(peerId);
    const peer: PeerProfile = {
      id: peerId,
      name: displayName(peerUser),
      subtitle: meta?.subtitle,
      avatarUrl: meta?.avatarUrl ?? peerUser.avatarUrl,
    };

    const existing = byPeer.get(peerId);
    const unreadInc = isIncoming && !message.isRead ? 1 : 0;

    if (!existing) {
      byPeer.set(peerId, {
        peer,
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
        unreadCount: unreadInc,
      });
      continue;
    }

    if (message.createdAt > existing.lastMessageAt) {
      existing.lastMessage = message.content;
      existing.lastMessageAt = message.createdAt;
    }
    existing.unreadCount += unreadInc;
    if (meta?.subtitle) {
      existing.peer.subtitle = meta.subtitle;
    }
  }

  return [...byPeer.values()].sort(
    (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
  );
}
