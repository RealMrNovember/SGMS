'use client';

import { userMessageChannel } from '@/lib/realtime/channels';
import Pusher from 'pusher-js';
import { useEffect, useState } from 'react';

export function MessageTypingBar({
  peerId,
  userId,
  organizationId,
}: {
  peerId: string;
  userId: string;
  organizationId: string;
}) {
  const [typing, setTyping] = useState(false);
  const soketiKey = process.env.NEXT_PUBLIC_SOKETI_KEY;

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function showTyping() {
      setTyping(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setTyping(false), 2800);
    }

    function onPayload(raw: string) {
      try {
        const parsed = JSON.parse(raw) as {
          type?: string;
          senderId?: string;
          receiverId?: string;
        };
        if (
          parsed.type === 'message.typing' &&
          parsed.senderId === peerId &&
          parsed.receiverId === userId
        ) {
          showTyping();
        }
      } catch {
        // ignore malformed events
      }
    }

    if (soketiKey) {
      const wsPath = process.env.NEXT_PUBLIC_SOKETI_WS_PATH ?? '/realtime/app';
      const forceTLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS !== 'false';
      const wsPort = Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT ?? (forceTLS ? 443 : 6001));
      const wssPort = Number(process.env.NEXT_PUBLIC_SOKETI_WSS_PORT ?? 443);
      const wsHost = process.env.NEXT_PUBLIC_SOKETI_WS_HOST ?? window.location.hostname;

      const pusher = new Pusher(soketiKey, {
        cluster: 'sgms',
        wsHost,
        wsPort,
        wssPort,
        wsPath,
        forceTLS,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/api/v1/realtime/auth',
      });

      const channelName = userMessageChannel(organizationId, userId);
      const channel = pusher.subscribe(channelName);
      const handler = (event: { type?: string; senderId?: string; receiverId?: string }) => {
        if (
          event.type === 'message.typing' &&
          event.senderId === peerId &&
          event.receiverId === userId
        ) {
          showTyping();
        }
      };
      channel.bind('message.typing', handler);

      return () => {
        channel.unbind('message.typing', handler);
        pusher.unsubscribe(channelName);
        pusher.disconnect();
        if (hideTimer) clearTimeout(hideTimer);
      };
    }

    const source = new EventSource('/api/v1/messages/events');
    source.onmessage = (event) => onPayload(event.data);
    source.addEventListener('message', (event) => onPayload((event as MessageEvent).data));

    return () => {
      source.close();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [organizationId, peerId, soketiKey, userId]);

  if (!typing) {
    return null;
  }

  return (
    <div className="px-4 py-2" aria-label="typing" role="status">
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
