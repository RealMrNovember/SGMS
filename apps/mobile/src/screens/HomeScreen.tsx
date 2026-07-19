import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { fetchCheckInQr, fetchMe, fetchMeasurements } from '../lib/api';
import { colors } from '../lib/theme';
import type { AthleteSession, HealthMeasurement, MeResponse } from '../lib/types';
import type { TabKey } from '../components/TabBar';

export function HomeScreen({
  session,
  onNavigate,
}: {
  session: AthleteSession;
  onNavigate: (tab: TabKey) => void;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<HealthMeasurement | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [meData, measurementsData] = await Promise.all([
        fetchMe(session.accessToken),
        fetchMeasurements(session.accessToken),
      ]);
      setMe(meData);
      setLatestMeasurement(measurementsData.measurements[0] ?? null);
    } catch {
      // sessiz — sayfa zaten kısmi verilerle çalışabilir
    }
  }, [session.accessToken]);

  const loadQr = useCallback(async () => {
    setQrError(null);
    try {
      const data = await fetchCheckInQr(session.accessToken);
      setQrToken(data.token);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'QR kod alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void loadAll();
    void loadQr();
    const interval = setInterval(() => void loadQr(), 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAll, loadQr]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadAll(), loadQr()]);
    setRefreshing(false);
  }

  const fullName = me ? `${me.gymMember.firstName} ${me.gymMember.lastName}` : session.user.name;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
    >
      <View style={styles.card}>
        <Text style={styles.name}>{fullName}</Text>
        {me ? (
          <Text style={styles.muted}>
            {me.gymMember.plan?.name ?? '—'} · {me.gymMember.status}
          </Text>
        ) : (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 8 }} />
        )}
        {me?.gymMember.membershipEndsAt ? (
          <Text style={styles.faint}>
            Üyelik bitiş: {new Date(me.gymMember.membershipEndsAt).toLocaleDateString('tr-TR')}
          </Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate('programs')}>
          <Text style={styles.statValue}>{me?.stats.activePrograms ?? '—'}</Text>
          <Text style={styles.statLabel}>Programlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate('measurements')}>
          <Text style={styles.statValue}>
            {latestMeasurement?.weight != null ? String(latestMeasurement.weight) : '—'}
          </Text>
          <Text style={styles.statLabel}>Kilo (kg)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate('messages')}>
          <Text style={styles.statValue}>{me?.stats.unreadMessages ?? '—'}</Text>
          <Text style={styles.statLabel}>Mesaj</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.qrCard}>
        <Text style={styles.qrTitle}>Salon Girişi</Text>
        {qrToken ? (
          <View style={styles.qrWhite}>
            <QRCode value={qrToken} size={190} />
          </View>
        ) : (
          <Text style={styles.muted}>{qrError ?? 'QR kod hazırlanıyor…'}</Text>
        )}
        <Text style={styles.faint}>Kodu turnikeye okutun · her 4 dakikada bir yenilenir</Text>
      </View>

      {latestMeasurement ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Son Ölçüm</Text>
          <View style={styles.measurementGrid}>
            <View style={styles.measurementItem}>
              <Text style={styles.faint}>Kilo</Text>
              <Text style={styles.measurementValue}>
                {latestMeasurement.weight != null ? `${latestMeasurement.weight} kg` : '—'}
              </Text>
            </View>
            <View style={styles.measurementItem}>
              <Text style={styles.faint}>Yağ Oranı</Text>
              <Text style={styles.measurementValue}>
                {latestMeasurement.bodyFatPercentage != null
                  ? `${latestMeasurement.bodyFatPercentage}%`
                  : '—'}
              </Text>
            </View>
            <View style={styles.measurementItem}>
              <Text style={styles.faint}>Kas Kütlesi</Text>
              <Text style={styles.measurementValue}>
                {latestMeasurement.muscleMass != null ? `${latestMeasurement.muscleMass} kg` : '—'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Antrenörünüz</Text>
        <Text style={styles.muted}>
          {me?.gymMember.trainer?.name ?? me?.gymMember.trainer?.email ?? 'Atanmış antrenör yok'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, marginTop: 6 },
  faint: { color: colors.faint, fontSize: 12, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { color: colors.gold, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.faint, fontSize: 11, marginTop: 4 },
  qrCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  qrTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  qrWhite: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  measurementGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  measurementItem: { alignItems: 'center', flex: 1 },
  measurementValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
});
