import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { TabBar, type TabKey } from './src/components/TabBar';
import { UpdateBanner } from './src/components/UpdateBanner';
import { AccountScreen } from './src/screens/AccountScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MeasurementsScreen } from './src/screens/MeasurementsScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { StoreScreen } from './src/screens/StoreScreen';
import { TrainersScreen } from './src/screens/TrainersScreen';
import { fetchMe } from './src/lib/api';
import { registerForPushNotifications } from './src/lib/push';
import { loadSession, saveSession } from './src/lib/storage';
import { colors } from './src/lib/theme';
import { checkForUpdate } from './src/lib/update-check';
import type { AthleteSession } from './src/lib/types';
import type { UpdateInfo } from './src/lib/types';

function AppShell() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<AthleteSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setChecking(false));

    checkForUpdate().then((info) => {
      if (info?.available) setUpdate(info);
    });

    if (!__DEV__) {
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
        .then((fetched) => {
          if (fetched?.isNew) {
            void Updates.reloadAsync();
          }
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void registerForPushNotifications(session.accessToken);
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
    setAuthMode('login');
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
        {authMode === 'signup' ? (
          <SignupScreen onSuccess={handleLoginSuccess} onBackToLogin={() => setAuthMode('login')} />
        ) : (
          <LoginScreen onSuccess={handleLoginSuccess} onGoSignup={() => setAuthMode('signup')} />
        )}
        <StatusBar style="light" />
      </>
    );
  }

  const screenTopInset = update ? 0 : insets.top;
  const anyOverlayOpen = trainersOpen || storeOpen || goalsOpen || eventsOpen || nutritionOpen;

  return (
    <View style={styles.app}>
      {update ? <UpdateBanner update={update} /> : null}
      <View style={[styles.screen, { paddingTop: screenTopInset }]}>
        {trainersOpen ? (
          <TrainersScreen session={session} onBack={() => setTrainersOpen(false)} />
        ) : null}
        {storeOpen ? <StoreScreen session={session} onBack={() => setStoreOpen(false)} /> : null}
        {goalsOpen ? <GoalsScreen session={session} onBack={() => setGoalsOpen(false)} /> : null}
        {eventsOpen ? <EventsScreen session={session} onBack={() => setEventsOpen(false)} /> : null}
        {nutritionOpen ? <NutritionScreen session={session} onBack={() => setNutritionOpen(false)} /> : null}
        {!anyOverlayOpen && activeTab === 'home' ? (
          <HomeScreen
            session={session}
            onNavigate={setActiveTab}
            onOpenTrainers={() => setTrainersOpen(true)}
            onOpenStore={() => setStoreOpen(true)}
            onOpenGoals={() => setGoalsOpen(true)}
            onOpenEvents={() => setEventsOpen(true)}
            onOpenNutrition={() => setNutritionOpen(true)}
          />
        ) : null}
        {!anyOverlayOpen && activeTab === 'programs' ? <ProgramsScreen session={session} /> : null}
        {!anyOverlayOpen && activeTab === 'measurements' ? <MeasurementsScreen session={session} /> : null}
        {!anyOverlayOpen && activeTab === 'messages' ? <MessagesScreen session={session} /> : null}
        {!anyOverlayOpen && activeTab === 'account' ? (
          <AccountScreen session={session} onLogout={handleLogout} />
        ) : null}
      </View>
      {!anyOverlayOpen ? (
        <TabBar active={activeTab} onChange={setActiveTab} badges={{ messages: unreadMessages }} />
      ) : null}
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  app: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
});
