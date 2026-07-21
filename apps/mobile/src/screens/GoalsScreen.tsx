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
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { cancelGoal, createGoal, fetchGoals } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteGoal, AthleteSession, GoalTargetType } from '../lib/types';

const TARGET_TYPE_LABEL: Record<GoalTargetType, string> = {
  WEIGHT_LOSS: 'Kilo Verme',
  WEIGHT_GAIN: 'Kilo Alma',
  BODY_FAT_REDUCTION: 'Yağ Oranı Düşürme',
  MEASUREMENT_CHANGE: 'Ölçüm Değişimi',
  WORKOUT_FREQUENCY: 'Antrenman Sıklığı',
  CUSTOM: 'Serbest Hedef',
};

const MEASUREMENT_FIELD_LABEL: Record<string, string> = {
  waistCm: 'Bel (cm)',
  chestCm: 'Göğüs (cm)',
  hipCm: 'Kalça (cm)',
  armCm: 'Kol (cm)',
  thighCm: 'Bacak (cm)',
};

const STATUS_TONE: Record<AthleteGoal['status'], 'gold' | 'success' | 'danger' | 'neutral'> = {
  ACTIVE: 'gold',
  ACHIEVED: 'success',
  MISSED: 'danger',
  CANCELLED: 'neutral',
};

const STATUS_LABEL: Record<AthleteGoal['status'], string> = {
  ACTIVE: 'Aktif',
  ACHIEVED: 'Ulaşıldı',
  MISSED: 'Kaçırıldı',
  CANCELLED: 'İptal',
};

const TARGET_TYPES: GoalTargetType[] = [
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'BODY_FAT_REDUCTION',
  'MEASUREMENT_CHANGE',
  'WORKOUT_FREQUENCY',
  'CUSTOM',
];

export function GoalsScreen({ session, onBack }: { session: AthleteSession; onBack: () => void }) {
  const [goals, setGoals] = useState<AthleteGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [targetType, setTargetType] = useState<GoalTargetType>('WEIGHT_LOSS');
  const [measurementField, setMeasurementField] = useState('waistCm');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      const data = await fetchGoals(session.accessToken);
      setGoals(data.goals);
    } catch {
      setError('Hedefler yüklenemedi.');
    }
  }, [session.accessToken]);

  useEffect(() => {
    setLoading(true);
    void loadGoals().finally(() => setLoading(false));
  }, [loadGoals]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createGoal(session.accessToken, {
        targetType,
        measurementField: targetType === 'MEASUREMENT_CHANGE' ? measurementField : undefined,
        direction: targetType === 'MEASUREMENT_CHANGE' ? direction : undefined,
        targetValue: targetValue ? Number(targetValue.replace(',', '.')) : undefined,
        targetDate: targetDate || undefined,
        notes: notes.trim() || undefined,
      });
      setMessage('Hedef oluşturuldu.');
      setTargetValue('');
      setTargetDate('');
      setNotes('');
      setFormOpen(false);
      await loadGoals();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hedef oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(goalId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await cancelGoal(session.accessToken, goalId);
      setMessage('Hedef iptal edildi.');
      await loadGoals();
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
        <Text style={styles.title}>Hedeflerim</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {formOpen ? (
        <Card>
          <Text style={styles.sectionTitle}>Yeni hedef</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Hedef türü</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TARGET_TYPES.map((type) => (
                <TypeChip
                  key={type}
                  label={TARGET_TYPE_LABEL[type]}
                  active={targetType === type}
                  onPress={() => setTargetType(type)}
                />
              ))}
            </ScrollView>
          </View>

          {targetType === 'MEASUREMENT_CHANGE' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Ölçüm alanı</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {Object.entries(MEASUREMENT_FIELD_LABEL).map(([field, label]) => (
                    <TypeChip
                      key={field}
                      label={label}
                      active={measurementField === field}
                      onPress={() => setMeasurementField(field)}
                    />
                  ))}
                </ScrollView>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Yön</Text>
                <View style={styles.chipRow}>
                  <TypeChip label="Azalt" active={direction === 'DECREASE'} onPress={() => setDirection('DECREASE')} />
                  <TypeChip label="Büyüt" active={direction === 'INCREASE'} onPress={() => setDirection('INCREASE')} />
                </View>
              </View>
            </>
          ) : null}

          {targetType !== 'CUSTOM' ? (
            <View style={styles.field}>
              <Text style={styles.label}>
                {targetType === 'WORKOUT_FREQUENCY' ? 'Haftalık antrenman sayısı' : 'Hedef değer'}
              </Text>
              <TextInput
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder={targetType === 'WORKOUT_FREQUENCY' ? 'örn. 3' : 'örn. 5'}
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Hedef tarih (opsiyonel)</Text>
            <TextInput
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="YYYY-AA-GG"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Not (opsiyonel)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Kendine bir hatırlatma yaz"
              placeholderTextColor={colors.faint}
              multiline
              style={styles.textarea}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button label="Hedefi oluştur" onPress={handleCreate} loading={submitting} />
            <Button label="Vazgeç" variant="ghost" onPress={() => setFormOpen(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Yeni hedef koy" icon="add-circle-outline" onPress={() => setFormOpen(true)} />
      )}

      {goals.length === 0 ? (
        <Card>
          <Text style={styles.hint}>Henüz bir hedefin yok. PT'in sana bir hedef atayabilir ya da kendin koyabilirsin.</Text>
        </Card>
      ) : (
        goals.map((goal) => <GoalCard key={goal.id} goal={goal} onCancel={() => handleCancel(goal.id)} busy={submitting} />)
      )}
    </ScrollView>
  );
}

function GoalCard({ goal, onCancel, busy }: { goal: AthleteGoal; onCancel: () => void; busy: boolean }) {
  const percent = goal.progressPercent ?? 0;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.goalTitle}>
          {TARGET_TYPE_LABEL[goal.targetType]}
          {goal.targetType === 'MEASUREMENT_CHANGE' && goal.measurementField
            ? ` — ${MEASUREMENT_FIELD_LABEL[goal.measurementField] ?? goal.measurementField}`
            : ''}
        </Text>
        <Badge label={STATUS_LABEL[goal.status]} tone={STATUS_TONE[goal.status]} />
      </View>
      {goal.createdByType === 'TRAINER' ? <Text style={styles.byTrainer}>PT tarafından atandı</Text> : null}

      {goal.progressPercent != null ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, percent))}%` }]} />
          </View>
          <Text style={styles.progressLabel}>%{Math.round(percent)} tamamlandı</Text>
        </View>
      ) : null}

      {goal.targetValue ? (
        <Text style={styles.goalMeta}>
          Hedef: {goal.targetValue}
          {goal.startValue ? ` · Başlangıç: ${goal.startValue}` : ''}
          {goal.currentValue != null ? ` · Şu an: ${goal.currentValue}` : ''}
        </Text>
      ) : null}
      {goal.targetDate ? (
        <Text style={styles.goalMeta}>Hedef tarih: {new Date(goal.targetDate).toLocaleDateString('tr-TR')}</Text>
      ) : null}
      {goal.notes ? <Text style={styles.goalNotes}>{goal.notes}</Text> : null}

      {goal.status === 'ACTIVE' ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button label="İptal et" variant="ghost" onPress={onCancel} loading={busy} />
        </View>
      ) : null}
    </Card>
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
  sectionTitle: { ...typography.subheading, color: colors.text, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hint: { ...typography.body, color: colors.muted },
  field: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.faint, marginBottom: 6 },
  chipRow: { gap: spacing.sm, flexWrap: 'wrap', flexDirection: 'row' },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
  textarea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    textAlignVertical: 'top',
  },
  goalTitle: { ...typography.subheading, color: colors.text, flex: 1, marginRight: spacing.sm },
  byTrainer: { ...typography.caption, color: colors.gold, marginTop: 4 },
  progressWrap: { marginTop: spacing.md, gap: 6 },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold },
  progressLabel: { ...typography.caption, color: colors.muted },
  goalMeta: { ...typography.caption, color: colors.muted, marginTop: 6 },
  goalNotes: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  error: { color: '#fca5a5', ...typography.caption },
  success: { color: '#86efac', ...typography.caption },
});
