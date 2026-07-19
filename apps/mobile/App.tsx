import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TabBar, type TabKey } from './src/components/TabBar';
import { UpdateBanner } from './src/components/UpdateBanner';
import { AccountScreen } from './src/screens/AccountScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MeasurementsScreen } from './src/screens/MeasurementsScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { fetchMe } from './src/lib/api';
import { loadSession, saveSession } from './src/lib/storage';
import { colors } from './src/lib/theme';
import { checkForUpdate } from './src/lib/update-check';
import type { AthleteSession } from './src/lib/types';
import type { UpdateInfo } from './src/lib/types';

export default function App() {
  const [session, setSession] = useState<AthleteSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setChecking(false));

    checkForUpdate().then((info) => {
      if (info?.available) setUpdate(info);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchMe(session.accessToken)
      .then((me) => setUnreadMessages(me.stats.unreadMessages))
      .catch(() => undefined);
    const interval = setInterval(() => {
      fetchMe(session.accessToken)
        .then((me) => setUnreadMessages(me.stats.unreadMessages))
        .catch(() => undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [session]);

  async function handleLoginSuccess(next: AthleteSession) {
    await saveSession(next);
    setSession(next);
    setActiveTab('home');
  }

  function handleLogout() {
    setSession(null);
    setActiveTab('home');
  }

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen onSuccess={handleLoginSuccess} />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <View style={styles.app}>
      {update ? <UpdateBanner update={update} /> : null}
      <View style={styles.screen}>
        {activeTab === 'home' ? <HomeScreen session={session} onNavigate={setActiveTab} /> : null}
        {activeTab === 'programs' ? <ProgramsScreen session={session} /> : null}
        {activeTab === 'measurements' ? <MeasurementsScreen session={session} /> : null}
        {activeTab === 'messages' ? <MessagesScreen session={session} /> : null}
        {activeTab === 'account' ? <AccountScreen session={session} onLogout={handleLogout} /> : null}
      </View>
      <TabBar active={activeTab} onChange={setActiveTab} badges={{ messages: unreadMessages }} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  app: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
});
