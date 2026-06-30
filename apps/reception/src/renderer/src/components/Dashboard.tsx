import { useMemo, useState } from 'react';
import type { CheckInNotificationPayload, ReceptionConfig } from '../../../shared/types';
import { CheckInCard } from './CheckInCard';
import { Logo } from './Logo';

type Props = {
  config: ReceptionConfig;
  feed: CheckInNotificationPayload[];
  online: boolean;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
  onLogout: () => void;
};

export function Dashboard({
  config,
  feed,
  online,
  launchAtStartup,
  onLaunchAtStartupChange,
  onLogout,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'entry' | 'exit'>('all');

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayItems = feed.filter((item) => new Date(item.checkedInAt).toDateString() === today);
    return {
      entries: todayItems.filter((item) => item.direction === 'ENTRY').length,
      exits: todayItems.filter((item) => item.direction === 'EXIT').length,
    };
  }, [feed]);

  const visibleFeed = feed.filter((item) => {
    if (filter === 'entry') return item.direction === 'ENTRY';
    if (filter === 'exit') return item.direction === 'EXIT';
    return true;
  });

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={56} />
          <div>
            <p className="eyebrow">CiCiByte SGMS</p>
            <h1>{config.organizationName}</h1>
          </div>
        </div>

        <div className={`connection ${online ? 'connection--online' : 'connection--offline'}`}>
          <span className="connection-pulse" />
          <div>
            <strong>{online ? 'Canlı bağlantı aktif' : 'Bağlantı bekleniyor'}</strong>
            <p>{online ? 'Turnike olayları anlık iletiliyor' : 'Soketi yeniden bağlanıyor…'}</p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card stat-card--entry">
            <span className="stat-label">Bugün giriş</span>
            <span className="stat-value">{stats.entries}</span>
          </div>
          <div className="stat-card stat-card--exit">
            <span className="stat-label">Bugün çıkış</span>
            <span className="stat-value">{stats.exits}</span>
          </div>
        </div>

        <div className="sidebar-user">
          <span className="sidebar-user-label">Resepsiyon</span>
          <strong>{config.userName}</strong>
        </div>

        <label className="setting-toggle">
          <div>
            <strong>Windows açılışında başlat</strong>
            <p>Bilgisayar açıldığında tepsi modunda otomatik dinleme</p>
          </div>
          <input
            type="checkbox"
            checked={launchAtStartup}
            onChange={(event) => onLaunchAtStartupChange(event.target.checked)}
          />
          <span className="setting-toggle-ui" />
        </label>

        <div className="sidebar-actions">
          <button type="button" className="ghost-btn" onClick={() => window.reception.hideToTray()}>
            Tepsiye gizle
          </button>
          <button type="button" className="ghost-btn ghost-btn--danger" onClick={onLogout}>
            Oturumu kapat
          </button>
        </div>

        <p className="sidebar-footnote">
          Pencereyi kapatsanız bile Windows bildirimleri ve tepsi dinleyicisi çalışmaya devam eder.
        </p>
      </aside>

      <main className="feed-panel">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Canlı akış</p>
            <h2>Giriş &amp; çıkış olayları</h2>
          </div>
          <div className="filter-tabs">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              Tümü
            </button>
            <button type="button" className={filter === 'entry' ? 'active' : ''} onClick={() => setFilter('entry')}>
              Giriş
            </button>
            <button type="button" className={filter === 'exit' ? 'active' : ''} onClick={() => setFilter('exit')}>
              Çıkış
            </button>
          </div>
        </header>

        <div className="feed-list">
          {visibleFeed.length === 0 ? (
            <div className="feed-empty">
              <Logo size={72} />
              <h3>Turnike bekleniyor</h3>
              <p>İlk kart okutması burada ve Windows bildiriminde görünecek.</p>
            </div>
          ) : (
            visibleFeed.map((item, index) => (
              <CheckInCard key={item.id} item={item} isNew={index === 0} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
