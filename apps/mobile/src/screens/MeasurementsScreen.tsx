import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PressableScale } from '../components/ui/PressableScale';
import { addMeasurement, fetchMeasurements } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, HealthMeasurement } from '../lib/types';

export function MeasurementsScreen({ session }: { session: AthleteSession }) {
  const [measurements, setMeasurements] = useState<HealthMeasurement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMeasurements(session.accessToken);
      setMeasurements(data.measurements);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ölçümler alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await addMeasurement(session.accessToken, {
        weight: weight ? Number(weight) : undefined,
        bodyFatPercentage: bodyFat ? Number(bodyFat) : undefined,
        muscleMass: muscle ? Number(muscle) : undefined,
        notes: notes || undefined,
      });
      setWeight('');
      setBodyFat('');
      setMuscle('');
      setNotes('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Ölçümlerim</Text>
        <PressableScale onPress={() => setFormOpen((v) => !v)} haptic style={styles.addButton}>
          <Ionicons name={formOpen ? 'close' : 'add'} size={16} color={colors.gold} />
          <Text style={styles.addButtonText}>{formOpen ? 'Vazgeç' : 'Ekle'}</Text>
        </PressableScale>
      </View>

      {formOpen ? (
        <Card>
          <LabeledInput icon="scale-outline" placeholder="Kilo (kg)" value={weight} onChangeText={setWeight} />
          <LabeledInput icon="water-outline" placeholder="Yağ oranı (%)" value={bodyFat} onChangeText={setBodyFat} />
          <LabeledInput icon="fitness-outline" placeholder="Kas kütlesi (kg)" value={muscle} onChangeText={setMuscle} />
          <LabeledInput
            icon="document-text-outline"
            placeholder="Not (opsiyonel)"
            value={notes}
            onChangeText={setNotes}
            keyboardType="default"
          />
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <View style={{ marginTop: spacing.xs }}>
            <Button label="Kaydet" onPress={handleSave} loading={saving} icon="checkmark-circle-outline" />
          </View>
        </Card>
      ) : null}

      {measurements === null && !error ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {measurements && measurements.length === 0 ? (
        <Card>
          <EmptyState
            icon="pulse-outline"
            title="Henüz ölçüm kaydınız yok"
            subtitle="Yukarıdaki 'Ekle' butonuyla ilk ölçümünüzü kaydedin."
          />
        </Card>
      ) : null}

      {measurements?.map((m) => (
        <Card key={m.id}>
          <Text style={styles.dateText}>
            {new Date(m.measuredAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.faint}>Kilo</Text>
              <Text style={styles.value}>{m.weight != null ? `${m.weight} kg` : '—'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.faint}>Yağ</Text>
              <Text style={styles.value}>{m.bodyFatPercentage != null ? `${m.bodyFatPercentage}%` : '—'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.faint}>Kas</Text>
              <Text style={styles.value}>{m.muscleMass != null ? `${m.muscleMass} kg` : '—'}</Text>
            </View>
          </View>
          {m.notes ? <Text style={styles.notes}>{m.notes}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

function LabeledInput({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'decimal-pad',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'default';
}) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={16} color={colors.faint} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title, color: colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addButtonText: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, paddingVertical: 11, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  dateText: { ...typography.subheading, color: colors.text },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  gridItem: { alignItems: 'center', flex: 1 },
  faint: { ...typography.caption, color: colors.faint },
  value: { ...typography.subheading, color: colors.text, marginTop: 2 },
  notes: { ...typography.caption, color: colors.muted, fontStyle: 'italic', marginTop: spacing.sm },
});
