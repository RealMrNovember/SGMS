import { useEffect, useState } from 'react';
import type { CheckInNotificationPayload, ReceptionConfig } from '../../../shared/types';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { TitleBar } from './components/TitleBar';

export default function App() {
  const [config, setConfig] = useState<ReceptionConfig | null>(null);
  const [feed, setFeed] = useState<CheckInNotificationPayload[]>([]);
  const [online, setOnline] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'realtime' | 'polling'>('polling');
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

  useEffect(() => {
    window.reception.getLaunchAtStartup().then(setLaunchAtStartup);
    window.reception.getConfig().then((saved) => {
      if (saved) {
        setConfig(saved);
      }
    });

    window.reception.onLoggedIn((next) => setConfig(next));
    window.reception.onFeedInit(({ items }) => {
      setFeed(items);
    });
    window.reception.onCheckIn((payload) => {
      setFeed((prev) => {
        if (prev.some((item) => item.id === payload.id)) {
          return prev;
        }
        return [payload, ...prev].slice(0, 200);
      });
    });
    window.reception.onStatus(({ online: isOnline, mode }) => {
      setOnline(isOnline);
      if (mode) {
        setConnectionMode(mode);
      }
    });
    window.reception.onLaunchAtStartup(({ enabled }) => setLaunchAtStartup(enabled));
  }, []);

  async function handleLaunchAtStartupChange(enabled: boolean) {
    const next = await window.reception.setLaunchAtStartup(enabled);
    setLaunchAtStartup(next);
  }

  async function handleLogout() {
    await window.reception.logout();
    setConfig(null);
    setFeed([]);
    setOnline(false);
  }

  return (
    <div className="app-shell">
      <TitleBar live={online} />
      {config ? (
        <Dashboard
          config={config}
          feed={feed}
          online={online}
          connectionMode={connectionMode}
          launchAtStartup={launchAtStartup}
          onLaunchAtStartupChange={handleLaunchAtStartupChange}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen onSuccess={setConfig} />
      )}
    </div>
  );
}
