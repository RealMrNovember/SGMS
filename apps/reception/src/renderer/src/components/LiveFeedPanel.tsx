import { useMemo, useState } from 'react';
import type { CheckInNotificationPayload } from '../../../shared/types';
import { CheckInCard } from './CheckInCard';
import { Logo } from './Logo';

type Props = {
  feed: CheckInNotificationPayload[];
};

export function LiveFeedPanel({ feed }: Props) {
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
    <section className="panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Canlı akış</p>
          <h2>Giriş &amp; çıkış olayları</h2>
        </div>
        <div className="panel-header__meta">
          <div className="mini-stat">
            <span>Giriş</span>
            <strong>{stats.entries}</strong>
          </div>
          <div className="mini-stat">
            <span>Çıkış</span>
            <strong>{stats.exits}</strong>
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
        </div>
      </header>

      <div className="feed-list">
        {visibleFeed.length === 0 ? (
          <div className="feed-empty">
            <Logo size={72} />
            <h3>Henüz olay yok</h3>
            <p>Turnike okutması veya manuel giriş burada görünecek.</p>
          </div>
        ) : (
          visibleFeed.map((item, index) => <CheckInCard key={item.id} item={item} isNew={index === 0} />)
        )}
      </div>
    </section>
  );
}
