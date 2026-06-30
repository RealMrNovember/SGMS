import Pusher from 'pusher';
import { orgStaffChannel, userMessageChannel } from '@/lib/realtime/channels';
import type { CheckInCreatedEvent, MessageCreatedEvent } from '@/lib/realtime/hub';

let cached: Pusher | null | undefined;

export function isSoketiServerConfigured(): boolean {
  return Boolean(
    process.env.SOKETI_APP_ID &&
      process.env.SOKETI_APP_KEY &&
      process.env.SOKETI_APP_SECRET,
  );
}

export function getPusherServer(): Pusher | null {
  if (cached !== undefined) {
    return cached;
  }

  if (!isSoketiServerConfigured()) {
    cached = null;
    return cached;
  }

  const host = process.env.SOKETI_HOST ?? '127.0.0.1';
  const port = process.env.SOKETI_PORT ?? '6001';
  const useTLS = process.env.SOKETI_USE_TLS === 'true';

  cached = new Pusher({
    appId: process.env.SOKETI_APP_ID!,
    key: process.env.SOKETI_APP_KEY!,
    secret: process.env.SOKETI_APP_SECRET!,
    host,
    port,
    useTLS,
  });

  return cached;
}

export function parseUserMessageChannel(channelName: string): { organizationId: string; userId: string } | null {
  const match = /^private-org\.([^.]+)\.user\.(.+)$/.exec(channelName);
  if (!match) {
    return null;
  }
  return { organizationId: match[1]!, userId: match[2]! };
}

export function parseOrgStaffChannel(channelName: string): string | null {
  const match = /^private-org\.([^.]+)\.staff$/.exec(channelName);
  return match?.[1] ?? null;
}

export function authorizeRealtimeChannel(
  socketId: string,
  channelName: string,
  organizationId: string,
  userId: string,
  isStaff: boolean,
): { auth: string } | null {
  const pusher = getPusherServer();
  if (!pusher) {
    return null;
  }

  const userChannel = parseUserMessageChannel(channelName);
  if (userChannel) {
    if (userChannel.organizationId !== organizationId || userChannel.userId !== userId) {
      return null;
    }
    return pusher.authorizeChannel(socketId, channelName);
  }

  const staffOrgId = parseOrgStaffChannel(channelName);
  if (staffOrgId) {
    if (!isStaff || staffOrgId !== organizationId) {
      return null;
    }
    return pusher.authorizeChannel(socketId, channelName);
  }

  return null;
}

/** @deprecated Use authorizeRealtimeChannel */
export function authorizeUserChannel(
  socketId: string,
  channelName: string,
  organizationId: string,
  userId: string,
): { auth: string } | null {
  return authorizeRealtimeChannel(socketId, channelName, organizationId, userId, false);
}

export async function publishMessageEventToSoketi(event: MessageCreatedEvent): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) {
    return;
  }

  await Promise.all(
    event.userIds.map((userId) =>
      pusher.trigger(userMessageChannel(event.organizationId, userId), event.type, {
        type: event.type,
        message: event.message,
        organizationId: event.organizationId,
      }),
    ),
  );
}

export async function publishCheckInEventToSoketi(event: CheckInCreatedEvent): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) {
    return;
  }

  await pusher.trigger(orgStaffChannel(event.organizationId), event.type, {
    type: event.type,
    checkIn: event.checkIn,
    organizationId: event.organizationId,
  });
}
