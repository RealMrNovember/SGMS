'use client';

import { orgStaffChannel } from '@/lib/realtime/channels';
import Pusher from 'pusher-js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function CheckInLiveRefresh({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const soketiKey = process.env.NEXT_PUBLIC_SOKETI_KEY;

  useEffect(() => {
    const refresh = () => {
      router.refresh();
    };

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

      const channelName = orgStaffChannel(organizationId);
      const channel = pusher.subscribe(channelName);

      const onCheckIn = () => refresh();
      channel.bind('checkin.created', onCheckIn);

      return () => {
        channel.unbind('checkin.created', onCheckIn);
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      };
    }

    const source = new EventSource('/api/v1/check-ins/events');

    source.addEventListener('message', refresh);
    source.onmessage = refresh;

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [organizationId, router, soketiKey]);

  return null;
}
