import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  cancelTrainerRequest,
  createTrainerRequest,
  fetchMe,
  fetchTrainerProfiles,
  fetchTrainerRequests,
} from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, TrainerProfile, TrainerRequest } from '../lib/types';

export function TrainersScreen({ session, onBack }: { session: AthleteSession; onBack: () => void }) {
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [pendingRequest, setPendingRequest] = useState<TrainerRequest | null>(null);
  const [hasTrainer, setHasTrainer] = useState(false);
  const [requestType, setRequestType] = useState<'ASSIGN' | 'CHANGE' | 'REMOVE'>('ASSIGN');
  const [preferredTrainerId, setPreferredTrainerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [trainerData, requestData, meData] = await Promise.all([
        fetchTrainerProfiles(session.accessToken),
        fetchTrainerRequests(session.accessToken),
        fetchMe(session.accessToken),
      ]);
      setTrainers(trainerData.trainers);
      const pending = requestData.requests.find((r) => r.status === 'PENDING') ?? null;
      setPendingRequest(pending);
      const currentHasTrainer = Boolean(meData.gymMember.trainer);
      setHasTrainer(currentHasTrainer);
      setRequestType(currentHasTrainer ? 'CHANGE' : 'ASSIGN');
    } catch {
      setError('Antrenör listesi yüklenemedi.');
    }
  }, [session.accessToken]);

  useEffect(() => {
    setLoading(true);
    void loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createTrainerRequest(session.accessToken, {
        requestType,
        preferredTrainerId: preferredTrainerId || undefined,
        reason: reason.trim() || undefined,
      });
      setMessage('Talebiniz alındı.');
      setReason('');
      setPreferredTrainerId('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Talep gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!pendingRequest) return;
    setSubmitting(true);
    setError(null);
    try {
      await cancelTrainerRequest(session.accessToken, pendingRequest.id);
      setMessage('Talep iptal edildi.');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İptal edilemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
    >
      <View style={styles.headerRow}>
        <Button label="Geri" variant="ghost" icon="arrow-back-outline" onPress={onBack} />
        <Text style={styles.title}>Antrenörler</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {pendingRequest ? (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Talebiniz inceleniyor</Text>
            <Badge label="Bekliyor" tone="gold" />
          </View>
          <Button
            label="Talebi iptal et"
            variant="secondary"
            onPress={handleCancel}
            loading={submitting}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>{hasTrainer ? 'Antrenör değişikliği' : 'Antrenör talep et'}</Text>
          <Text style={styles.hint}>Gerekçeniz yalnızca yönetime görünür.</Text>
          <View style={styles.typeRow}>
            {hasTrainer ? (
              <>
                <TypeChip label="Değiştir" active={requestType === 'CHANGE'} onPress={() => setRequestType('CHANGE')} />
                <TypeChip label="Kaldır" active={requestType === 'REMOVE'} onPress={() => setRequestType('REMOVE')} />
              </>
            ) : (
              <TypeChip label="Atama" active={requestType === 'ASSIGN'} onPress={() => setRequestType('ASSIGN')} />
            )}
          </View>
          {requestType !== 'REMOVE' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Tercih (opsiyonel)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TypeChip
                  label="Fark etmez"
                  active={!preferredTrainerId}
                  onPress={() => setPreferredTrainerId('')}
                />
                {trainers.map((trainer) => (
                  <TypeChip
                    key={trainer.userId}
                    label={trainer.name.split(' ')[0]}
                    active={preferredTrainerId === trainer.userId}
                    onPress={() => setPreferredTrainerId(trainer.userId)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.field}>
            <Text style={styles.label}>Gerekçe (opsiyonel)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Yalnızca yönetim görür"
              placeholderTextColor={colors.faint}
              multiline
              style={styles.textarea}
            />
          </View>
          <Button label="Talebi gönder" onPress={handleSubmit} loading={submitting} />
        </Card>
      )}

      {trainers.map((trainer) => (
        <Card key={trainer.userId}>
          <View style={styles.trainerRow}>
            <Avatar name={trainer.name} uri={trainer.avatarUrl} size={44} />
            <View style={styles.trainerInfo}>
              <View style={styles.rowBetween}>
                <Text style={styles.trainerName}>{trainer.name}</Text>
                {trainer.isAtCapacity ? <Badge label="Dolu" tone="neutral" /> : null}
              </View>
              {trainer.specialties.length > 0 ? (
                <Text style={styles.specialties}>{trainer.specialties.join(' · ')}</Text>
              ) : null}
              {trainer.maxMembers != null ? (
                <Text style={styles.capacity}>
                  {trainer.memberCount}/{trainer.maxMembers} üye
                </Text>
              ) : null}
              {trainer.bio ? <Text style={styles.bio}>{trainer.bio}</Text> : null}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function TypeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  sectionTitle: { ...typography.subheading, color: colors.text },
  hint: { ...typography.caption, color: colors.muted, marginTop: 4, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.muted,
    overflow: 'hidden',
  },
  chipActive: { borderColor: colors.gold, color: colors.gold, backgroundColor: colors.goldSoft },
  field: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.faint, marginBottom: 6 },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    textAlignVertical: 'top',
  },
  trainerRow: { flexDirection: 'row', gap: spacing.md },
  trainerInfo: { flex: 1 },
  trainerName: { ...typography.subheading, color: colors.text },
  specialties: { ...typography.caption, color: colors.gold, marginTop: 4 },
  capacity: { ...typography.caption, color: colors.faint, marginTop: 4 },
  bio: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  error: { color: '#fca5a5', ...typography.caption },
  success: { color: '#86efac', ...typography.caption },
});
