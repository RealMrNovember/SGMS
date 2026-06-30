'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslations } from 'next-intl';

type QrResponse = {
  ok: boolean;
  data?: {
    token: string;
    expiresAt: string;
    refreshAfterSeconds: number;
  };
};

export function CheckInQrPanel() {
  const t = useTranslations('checkIn.athleteQr');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/check-in/qr', { credentials: 'include' });
      const json = (await res.json()) as QrResponse;
      if (!res.ok || !json.ok || !json.data) {
        setError(t('loadError'));
        return;
      }
      setToken(json.data.token);
      setExpiresAt(new Date(json.data.expiresAt));
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadToken();
    const interval = setInterval(() => {
      void loadToken();
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadToken]);

  return (
    <section className="card p-5">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <p className="muted mt-1 text-sm">{t('subtitle')}</p>

      <div className="mt-5 flex flex-col items-center gap-4">
        {loading && !token ? (
          <p className="muted text-sm">{t('loading')}</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : token ? (
          <div className="rounded-2xl bg-white p-4">
            <QRCode value={token} size={200} level="M" />
          </div>
        ) : null}

        {expiresAt ? (
          <p className="muted text-center text-xs">
            {t('expires', {
              time: expiresAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            })}
          </p>
        ) : null}

        <button type="button" className="button px-4 py-2 text-xs" onClick={() => void loadToken()}>
          {t('refresh')}
        </button>
      </div>
    </section>
  );
}
