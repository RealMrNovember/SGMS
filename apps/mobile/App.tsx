import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { loadSession, saveSession } from './src/lib/storage';
import type { AthleteSession } from './src/lib/types';

export default function App() {
  const [session, setSession] = useState<AthleteSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    loadSession()
      .then(setSession)
      .finally(() => setChecking(false));
  }, []);

  async function handleLoginSuccess(next: AthleteSession) {
    await saveSession(next);
    setSession(next);
  }

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#c9a962" />
      </View>
    );
  }

  return (
    <>
      {session ? (
        <CheckInScreen session={session} onLogout={() => setSession(null)} />
      ) : (
        <LoginScreen onSuccess={handleLoginSuccess} />
      )}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
