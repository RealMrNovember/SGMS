import { useEffect, useState } from 'react';
import type { CheckInNotificationPayload, ReceptionConfig } from '../../../shared/types';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { TitleBar } from './components/TitleBar';

export default function App() {
  const [config, setConfig] = useState<ReceptionConfig | null>(null);
  const [feed, setFeed] = useState<CheckInNotificationPayload[]>([]);
  const [online, setOnline] = useState(false);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [savedApiUrl, setSavedApiUrl] = useState<string>();
  const [savedSoketiKey, setSavedSoketiKey] = useState<string>();

  useEffect(() => {
    window.reception.getConfig().then((saved) => {
      if (saved?.apiBaseUrl) setSavedApiUrl(saved.apiBaseUrl);
      if (saved?.soketiKey) setSavedSoketiKey(saved.soketiKey);
    });

    window.reception.getLaunchAtStartup().then(setLaunchAtStartup);

    window.reception.onLoggedIn((next) => setConfig(next));
    window.reception.onCheckIn((payload) => {
      setFeed((prev) => [payload, ...prev].slice(0, 120));
    });
    window.reception.onStatus(({ online: isOnline }) => setOnline(isOnline));
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
      <TitleBar />
      {config ? (
        <Dashboard
          config={config}
          feed={feed}
          online={online}
          launchAtStartup={launchAtStartup}
          onLaunchAtStartupChange={handleLaunchAtStartupChange}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen
          onSuccess={setConfig}
          initialApiUrl={savedApiUrl}
          initialSoketiKey={savedSoketiKey}
        />
      )}
    </div>
  );
}
