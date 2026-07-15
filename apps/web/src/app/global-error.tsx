'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error-boundary]', error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070b12',
          color: '#e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', padding: '0 20px' }}>
          <span
            style={{
              display: 'inline-flex',
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: '1px solid rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.1)',
              fontSize: 24,
            }}
          >
            !
          </span>
          <h1 style={{ marginTop: 20, fontSize: 20, fontWeight: 600 }}>Beklenmedik bir sistem hatası</h1>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: '#9ca3af' }}>
            Sayfa yüklenirken beklenmedik bir hata oluştu. Lütfen tekrar deneyin; sorun devam ederse
            birkaç dakika sonra tekrar ziyaret edin.
          </p>
          <div style={{ marginTop: 28 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '1px solid rgba(201,169,98,0.4)',
                background: 'rgba(201,169,98,0.12)',
                color: '#f3f4f6',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
