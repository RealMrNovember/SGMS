import { useEffect, useState } from 'react';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.reception.isMaximized().then(setMaximized);
    window.reception.onMaximizedChange(setMaximized);
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <span className="titlebar-dot titlebar-dot--live" />
        <span className="titlebar-label">SGMS Resepsiyon</span>
      </div>
      <div className="titlebar-actions">
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
