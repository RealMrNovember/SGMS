import { useEffect, useState } from 'react';

export function TitleBar({ live = false }: { live?: boolean }) {
  const [maximized, setMaximized] = useState(false);
  const [updateReady, setUpdateReady] = useState<string | null>(null);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    window.reception.isMaximized().then(setMaximized);
    window.reception.onMaximizedChange(setMaximized);
    window.reception.getTheme().then(setThemeState);
    window.reception.onUpdateStatus((status) => {
      if (status.state === 'downloaded') {
        setUpdateReady(status.version);
      }
    });
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    void window.reception.setTheme(next);
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <span className={`titlebar-dot ${live ? 'titlebar-dot--live' : ''}`} />
        <span className="titlebar-label">SGMS Resepsiyon</span>
        {updateReady ? (
          <button
            type="button"
            className="titlebar-update-badge"
            onClick={() => window.reception.installUpdateNow()}
            title={`v${updateReady} indirildi — şimdi yeniden başlatıp yükle`}
          >
            Güncelleme hazır · yeniden başlat
          </button>
        ) : null}
      </div>
      <div className="titlebar-actions">
        <button
          type="button"
          className="titlebar-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
          title={theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="3.5" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
              </g>
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M13.5 9.5A6 6 0 0 1 6.5 2.5 6 6 0 1 0 13.5 9.5z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.reception.minimize()}
          aria-label="Küçült"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.reception.toggleMaximize()}
          aria-label={maximized ? 'Önceki boyuta döndür' : 'Ekranı kapla'}
        >
          {maximized ? (
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M3.5 2.5h4v4M8.5 5.5v4h-4"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn--close"
          onClick={() => window.reception.hideToTray()}
          aria-label="Tepsiye gizle"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
