import { publishMessageEventToSoketi } from '@/lib/realtime/pusher-server';

export type RealtimeMessagePayload = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

export type MessageCreatedEvent = {
  type: 'message.created';
  organizationId: string;
  userIds: string[];
  message: RealtimeMessagePayload;
};

type Listener = (chunk: string) => void;

const userListeners = new Map<string, Set<Listener>>();

function listenersFor(userId: string) {
  let set = userListeners.get(userId);
  if (!set) {
    set = new Set();
    userListeners.set(userId, set);
  }
  return set;
}

export function subscribeUserMessages(userId: string, listener: Listener) {
  listenersFor(userId).add(listener);
  return () => {
    const set = userListeners.get(userId);
    if (!set) {
      return;
    }
    set.delete(listener);
    if (set.size === 0) {
      userListeners.delete(userId);
    }
  };
}

export function publishMessageEvent(event: MessageCreatedEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of event.userIds) {
    const set = userListeners.get(userId);
    if (!set) {
      continue;
    }
    for (const listener of set) {
      listener(payload);
    }
  }

  void publishMessageEventToSoketi(event).catch(() => {
    // Soketi optional — SSE remains primary fallback
  });
}

export function heartbeatChunk() {
  return `: ping ${Date.now()}\n\n`;
}
