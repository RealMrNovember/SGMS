import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckInQrModal } from '../components/CheckInQrModal';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PressableScale } from '../components/ui/PressableScale';
import { fetchMe, fetchMeasurements, fetchTrainerRequests } from '../lib/api';
import { colors, gradients, radius, shadow, spacing, typography } from '../lib/theme';
import type { AthleteSession, HealthMeasurement, MeResponse } from '../lib/types';
import type { TabKey } from '../components/TabBar';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktif Üye',
  FROZEN: 'Dondurulmuş',
  INACTIVE: 'Pasif',
  SUSPENDED: 'Askıda',
};

export function HomeScreen({
  session,
  onNavigate,
  onOpenTrainers,
}: {
  session: AthleteSession;
  onNavigate: (tab: TabKey) => void;
  onOpenTrainers: () => void;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<HealthMeasurement | null>(null);
  const [hasPendingTrainerRequest, setHasPendingTrainerRequest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [meData, measurementsData, trainerRequests] = await Promise.all([
        fetchMe(session.accessToken),
        fetchMeasurements(session.accessToken),
        fetchTrainerRequests(session.accessToken),
      ]);
      setMe(meData);
      setLatestMeasurement(measurementsData.measurements[0] ?? null);
      setHasPendingTrainerRequest(trainerRequests.requests.some((r) => r.status === 'PENDING'));
    } catch {
      // sessiz — sayfa zaten kısmi verilerle çalışabilir
    }
  }, [session.accessToken]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  const fullName = me ? `${me.gymMember.firstName} ${me.gymMember.lastName}` : session.user.name;
  const statusTone = me?.gymMember.status === 'ACTIVE' ? 'success' : 'neutral';

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Avatar name={fullName} uri={me?.gymMember.avatarUrl} size={54} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hoş geldin</Text>
            <Text style={styles.name} numberOfLines={1}>
              {fullName}
            </Text>
          </View>
        </View>

        {me ? (
          <View style={styles.metaRow}>
            <Badge label={STATUS_LABEL[me.gymMember.status] ?? me.gymMember.status} tone={statusTone} />
            {me.gymMember.plan ? <Badge label={me.gymMember.plan.name} tone="gold" /> : null}
          </View>
        ) : (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />
        )}

        <PressableScale onPress={() => setQrVisible(true)} haptic style={styles.qrCtaWrap}>
          <LinearGradient
            colors={gradients.hero}
            style={[styles.qrCta, shadow.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.qrCtaIcon}>
              <Ionicons name="qr-code-outline" size={26} color={colors.gold} />
            </View>
            <View style={styles.qrCtaTextWrap}>
              <Text style={styles.qrCtaTitle}>Salona Giriş Yap</Text>
              <Text style={styles.qrCtaSubtitle}>QR kodunu göstermek için dokun</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </LinearGradient>
        </PressableScale>

        <View style={styles.statsRow}>
          <StatCard
            icon="barbell-outline"
            value={me?.stats.activePrograms ?? '—'}
            label="Programlar"
            onPress={() => onNavigate('programs')}
          />
          <StatCard
            icon="scale-outline"
            value={latestMeasurement?.weight != null ? String(latestMeasurement.weight) : '—'}
            label="Kilo (kg)"
            onPress={() => onNavigate('measurements')}
          />
          <StatCard
            icon="chatbubble-ellipses-outline"
            value={me?.stats.unreadMessages ?? '—'}
            label="Mesaj"
            onPress={() => onNavigate('messages')}
          />
        </View>

        {latestMeasurement ? (
          <Card>
            <SectionTitle icon="pulse-outline" label="Son Ölçüm" />
            <View style={styles.measurementGrid}>
              <MeasurementItem label="Kilo" value={latestMeasurement.weight != null ? `${latestMeasurement.weight} kg` : '—'} />
              <MeasurementItem
                label="Yağ Oranı"
                value={latestMeasurement.bodyFatPercentage != null ? `${latestMeasurement.bodyFatPercentage}%` : '—'}
              />
              <MeasurementItem
                label="Kas Kütlesi"
                value={latestMeasurement.muscleMass != null ? `${latestMeasurement.muscleMass} kg` : '—'}
              />
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={styles.trainerHeader}>
            <SectionTitle icon="person-outline" label="Antrenörünüz" />
            {hasPendingTrainerRequest ? <Badge label="İnceleniyor" tone="gold" /> : null}
          </View>
          <Text style={styles.trainerName}>
            {me?.gymMember.trainer?.name ?? me?.gymMember.trainer?.email ?? 'Atanmış antrenör yok'}
          </Text>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button label="Antrenörler / Talep" variant="secondary" icon="people-outline" onPress={onOpenTrainers} />
            {me?.gymMember.trainer ? (
              <Button
                label="Mesaj Gönder"
                variant="secondary"
                icon="chatbubble-outline"
                onPress={() => onNavigate('messages')}
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <CheckInQrModal visible={qrVisible} accessToken={session.accessToken} onClose={() => setQrVisible(false)} />
    </>
  );
}

function StatCard({
  icon,
  value,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic style={styles.statCardWrap}>
      <View style={styles.statCard}>
        <Ionicons name={icon} size={18} color={colors.gold} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function SectionTitle({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

function MeasurementItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.measurementItem}>
      <Text style={styles.faint}>{label}</Text>
      <Text style={styles.measurementValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  greeting: { ...typography.caption, color: colors.faint },
  name: { ...typography.title, color: colors.text, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  qrCtaWrap: { marginTop: spacing.xs },
  qrCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  qrCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCtaTextWrap: { flex: 1 },
  qrCtaTitle: { ...typography.heading, color: colors.text },
  qrCtaSubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCardWrap: { flex: 1 },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { ...typography.heading, color: colors.text },
  statLabel: { ...typography.tiny, color: colors.faint },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { ...typography.subheading, color: colors.text },
  trainerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  trainerName: { ...typography.body, color: colors.muted },
  measurementGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  measurementItem: { alignItems: 'center', flex: 1 },
  faint: { ...typography.caption, color: colors.faint },
  measurementValue: { ...typography.subheading, color: colors.text, marginTop: 4 },
});
