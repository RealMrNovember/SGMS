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
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { StoreScreen } from './src/screens/StoreScreen';
import { TrainersScreen } from './src/screens/TrainersScreen';
import { fetchMe } from './src/lib/api';
import { loadSession, saveSession } from './src/lib/storage';
import { colors } from './src/lib/theme';
import { checkForUpdate } from './src/lib/update-check';
import type { AthleteSession } from './src/lib/types';
import type { UpdateInfo } from './src/lib/types';

function AppShell() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<AthleteSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setChecking(false));

    // Native (APK) sürüm kontrolü — yalnızca yeni bir native değişiklik (yeni izin,
    // native modül, Expo SDK yükseltmesi vb.) olduğunda gerçekten yeni bir APK
    // gerekiyorsa banner gösterilir. Çoğu JS/TSX değişikliği bunun yerine aşağıdaki
    // OTA (expo-updates) akışıyla sessizce, APK indirmeden uygulanır.
    checkForUpdate().then((info) => {
      if (info?.available) setUpdate(info);
    });

    // OTA güncelleme — Faz 20.5: JS-only değişiklikler (özellik/hata düzeltmeleri)
    // arkadaş/test cihazlarına dahil APK kurmadan otomatik ulaşsın diye. `__DEV__`
    // sırasında (Metro ile geliştirirken) expo-updates devre dışı — yalnızca
    // derlenmiş release build'de anlamlı.
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

  // Ekranlar kendi üst dolgusunu eklemez — üstteki güncelleme bandı gösterildiğinde
  // çift boşluk oluşmasın diye tek bir yerden (burada) yönetiliyor. Alt boşluk ise
  // TabBar kendi güvenli alan payını zaten ayırdığı için ekranlara eklenmiyor.
  const screenTopInset = update ? 0 : insets.top;
  const anyOverlayOpen = trainersOpen || storeOpen || goalsOpen || eventsOpen;

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
        {!anyOverlayOpen && activeTab === 'home' ? (
          <HomeScreen
            session={session}
            onNavigate={setActiveTab}
            onOpenTrainers={() => setTrainersOpen(true)}
            onOpenStore={() => setStoreOpen(true)}
            onOpenGoals={() => setGoalsOpen(true)}
            onOpenEvents={() => setEventsOpen(true)}
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
