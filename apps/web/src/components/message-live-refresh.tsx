'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function MessageLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource('/api/v1/messages/events');

    const refresh = () => {
      router.refresh();
    };

    source.addEventListener('message', refresh);
    source.onmessage = refresh;

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [router]);

  return null;
}
