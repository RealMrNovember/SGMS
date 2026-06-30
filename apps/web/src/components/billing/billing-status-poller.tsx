'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function BillingStatusPoller({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/v1/billing/status', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok: boolean;
          data?: { mode: string };
        };
        if (!cancelled && json.ok && json.data?.mode === 'full') {
          router.replace('/dashboard');
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    }

    poll();
    const id = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, router]);

  return null;
}
