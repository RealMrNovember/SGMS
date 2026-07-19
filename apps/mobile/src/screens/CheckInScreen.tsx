import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { fetchCheckInQr, logout } from '../lib/api';
import { clearSession } from '../lib/storage';
import type { AthleteSession } from '../lib/types';

export function CheckInScreen({
  session,
  onLogout,
}: {
  session: AthleteSession;
  onLogout: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadToken = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchCheckInQr(session.accessToken);
      setToken(data.token);
      setExpiresAt(new Date(data.expiresAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR kod alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void loadToken();
    const interval = setInterval(() => void loadToken(), 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadToken]);

  async function handleLogout() {
    await logout(session.accessToken);
    await clearSession();
    onLogout();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Merhaba, {session.user.name}</Text>

      <View style={styles.qrCard}>
        {token ? (
          <QRCode value={token} size={220} />
        ) : (
          <Text style={styles.muted}>{error ?? 'QR kod hazırlanıyor…'}</Text>
        )}
      </View>

      {expiresAt ? (
        <Text style={styles.expires}>
          Yenileme:{' '}
          {expiresAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      ) : null}

      <TouchableOpacity style={styles.refreshButton} onPress={() => void loadToken()}>
        <Text style={styles.refreshText}>Yenile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  greeting: {
    fontSize: 18,
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 8,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    minWidth: 260,
  },
  muted: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  expires: {
    color: '#94a3b8',
    fontSize: 12,
  },
  refreshButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  refreshText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 24,
  },
  logoutText: {
    color: '#64748b',
    fontSize: 13,
  },
});
