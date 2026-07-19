import { useState } from 'react';
import type { CheckInNotificationPayload, ReceptionConfig } from '../../../shared/types';
import { LiveFeedPanel } from './LiveFeedPanel';
import { ManualCheckInPanel } from './ManualCheckInPanel';
import { MembersPanel } from './MembersPanel';
import { PosPanel } from './PosPanel';
import { SettingsPanel } from './SettingsPanel';
import { SidebarNav, type ReceptionTab } from './SidebarNav';
import { Logo } from './Logo';

type Props = {
  config: ReceptionConfig;
  feed: CheckInNotificationPayload[];
  online: boolean;
  connectionMode?: 'realtime' | 'polling';
  pendingQueueCount?: number;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
  onLogout: () => void;
};

export function Dashboard({
  config,
  feed,
  online,
  connectionMode = 'polling',
  pendingQueueCount = 0,
  launchAtStartup,
  onLaunchAtStartupChange,
  onLogout,
}: Props) {
  const [tab, setTab] = useState<ReceptionTab>('feed');
  const [posMemberId, setPosMemberId] = useState<string | undefined>();

  function goToPos(memberId?: string) {
    setPosMemberId(memberId);
    setTab('pos');
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={52} />
          <div>
            <p className="eyebrow">CiCiByte SGMS</p>
            <h1>{config.organizationName}</h1>
          </div>
        </div>

        <SidebarNav active={tab} onChange={setTab} />

        <div className={`connection ${online ? 'connection--online' : 'connection--offline'}`}>
          <span className="connection-pulse" />
          <div>
            <strong>{online ? 'Canlı bağlantı aktif' : 'Yedek senkron aktif'}</strong>
            <p>
              {online
                ? 'Turnike olayları anlık iletiliyor'
                : connectionMode === 'polling'
                  ? 'Soketi kapalı — olaylar 20 sn aralıkla çekiliyor'
                  : 'Soketi yeniden bağlanıyor…'}
            </p>
          </div>
        </div>

        {pendingQueueCount > 0 ? (
          <div className="connection connection--queue">
            <span className="connection-pulse" />
            <div>
              <strong>Çevrimdışı · {pendingQueueCount} olay bekliyor</strong>
              <p>Bağlantı kurulunca otomatik ve sırayla gönderilecek.</p>
            </div>
          </div>
        ) : null}

        <div className="sidebar-user">
          <span className="sidebar-user-label">Resepsiyon</span>
          <strong>{config.userName}</strong>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="ghost-btn" onClick={() => window.reception.hideToTray()}>
            Tepsiye gizle
          </button>
          <button type="button" className="ghost-btn ghost-btn--danger" onClick={onLogout}>
            Oturumu kapat
          </button>
        </div>
      </aside>

      <main className="workspace">
        {tab === 'feed' ? <LiveFeedPanel feed={feed} /> : null}
        {tab === 'members' ? <MembersPanel onOpenPos={goToPos} /> : null}
        {tab === 'checkin' ? <ManualCheckInPanel /> : null}
        {tab === 'pos' ? <PosPanel initialMemberId={posMemberId} /> : null}
        {tab === 'settings' ? (
          <SettingsPanel
            config={config}
            launchAtStartup={launchAtStartup}
            onLaunchAtStartupChange={onLaunchAtStartupChange}
          />
        ) : null}
      </main>
    </div>
  );
}
