import {
  publishCheckInEventToSoketi,
  publishMessageEventToSoketi,
  publishMessageReadEventToSoketi,
  publishTypingEventToSoketi,
} from '@/lib/realtime/pusher-server';

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

export type MessageTypingEvent = {
  type: 'message.typing';
  organizationId: string;
  userIds: string[];
  senderId: string;
  receiverId: string;
};

export type MessageReadEvent = {
  type: 'message.read';
  organizationId: string;
  userIds: string[];
  readerId: string;
  peerId: string;
  readAt: string;
};

export type RealtimeEvent =
  | MessageCreatedEvent
  | MessageTypingEvent
  | MessageReadEvent
  | CheckInCreatedEvent;

export type CheckInCreatedPayload = {
  id: string;
  subjectType: string;
  direction: string;
  gymMemberId: string | null;
  staffUserId: string | null;
  personName: string;
  subtitle: string;
  avatarUrl: string | null;
  role: string | null;
  memberName: string;
  method: string;
  checkedInAt: string;
  deviceId: string | null;
  deviceName: string | null;
};

export type CheckInCreatedEvent = {
  type: 'checkin.created';
  organizationId: string;
  checkIn: CheckInCreatedPayload;
};

type Listener = (chunk: string) => void;

const userListeners = new Map<string, Set<Listener>>();
const orgListeners = new Map<string, Set<Listener>>();

function listenersFor(map: Map<string, Set<Listener>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

export function subscribeUserMessages(userId: string, listener: Listener) {
  listenersFor(userListeners, userId).add(listener);
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

export function subscribeOrgCheckIns(organizationId: string, listener: Listener) {
  listenersFor(orgListeners, organizationId).add(listener);
  return () => {
    const set = orgListeners.get(organizationId);
    if (!set) {
      return;
    }
    set.delete(listener);
    if (set.size === 0) {
      orgListeners.delete(organizationId);
    }
  };
}

function broadcast(map: Map<string, Set<Listener>>, key: string, payload: string) {
  const set = map.get(key);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener(payload);
  }
}

export function publishMessageEvent(event: MessageCreatedEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of event.userIds) {
    broadcast(userListeners, userId, payload);
  }

  void publishMessageEventToSoketi(event).catch(() => {
    // Soketi optional — SSE remains primary fallback
  });
}

export function publishTypingEvent(event: MessageTypingEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of event.userIds) {
    broadcast(userListeners, userId, payload);
  }

  void publishTypingEventToSoketi(event).catch(() => {
    // optional
  });
}

export function publishMessageReadEvent(event: MessageReadEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of event.userIds) {
    broadcast(userListeners, userId, payload);
  }

  void publishMessageReadEventToSoketi(event).catch(() => {
    // Soketi optional — SSE remains primary fallback
  });
}

export function publishCheckInEvent(event: CheckInCreatedEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  broadcast(orgListeners, event.organizationId, payload);

  void publishCheckInEventToSoketi(event).catch(() => {
    // Soketi optional
  });
}

export function heartbeatChunk() {
  return `: ping ${Date.now()}\n\n`;
}
