'use client';

import { subscribeToPush, unsubscribeFromPush } from '@/actions/push';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = 'unsupported' | 'loading' | 'off' | 'on' | 'denied';

export function PushNotificationToggle() {
  const t = useTranslations('push');
  const [status, setStatus] = useState<Status>('loading');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setStatus('unsupported');
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus('unsupported');
      return;
    }

    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      await subscribeToPush({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        userAgent: navigator.userAgent,
      });

      setStatus('on');
    } catch {
      setStatus('off');
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus('off');
    } catch {
      // no-op — durum bir sonraki kontrolde düzelir
    } finally {
      setPending(false);
    }
  }

  if (status === 'unsupported' || status === 'loading') {
    return null;
  }

  if (status === 'denied') {
    return (
      <span className="muted text-xs" title={t('deniedHint')}>
        🔕
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (status === 'on' ? disable() : enable())}
      disabled={pending}
      title={status === 'on' ? t('disable') : t('enable')}
      aria-label={status === 'on' ? t('disable') : t('enable')}
      className="button flex h-9 w-9 items-center justify-center p-0 text-base"
    >
      {status === 'on' ? '🔔' : '🔕'}
    </button>
  );
}
