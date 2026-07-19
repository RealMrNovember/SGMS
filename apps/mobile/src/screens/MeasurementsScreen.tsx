import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addMeasurement, fetchMeasurements } from '../lib/api';
import { colors } from '../lib/theme';
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
    >
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Ölçümlerim</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setFormOpen((v) => !v)}>
          <Text style={styles.addButtonText}>{formOpen ? 'Vazgeç' : '+ Ekle'}</Text>
        </TouchableOpacity>
      </View>

      {formOpen ? (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Kilo (kg)"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={styles.input}
            placeholder="Yağ oranı (%)"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            value={bodyFat}
            onChangeText={setBodyFat}
          />
          <TextInput
            style={styles.input}
            placeholder="Kas kütlesi (kg)"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            value={muscle}
            onChangeText={setMuscle}
          />
          <TextInput
            style={styles.input}
            placeholder="Not (opsiyonel)"
            placeholderTextColor={colors.faint}
            value={notes}
            onChangeText={setNotes}
          />
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0b1220" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {measurements === null && !error ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {measurements && measurements.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Henüz kayıtlı ölçümünüz yok.</Text>
        </View>
      ) : null}

      {measurements?.map((m) => (
        <View key={m.id} style={styles.card}>
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
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  addButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  saveButton: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#0b1220', fontWeight: '700', fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },
  faint: { color: colors.faint, fontSize: 11 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  dateText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { alignItems: 'center', flex: 1 },
  value: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  notes: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
});
