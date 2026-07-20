import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MeasurementSparkline } from '../components/MeasurementSparkline';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PressableScale } from '../components/ui/PressableScale';
import { addMeasurement, fetchMeasurementPhotos, fetchMeasurements } from '../lib/api';
import { computeBmi } from '../lib/bmi';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, HealthMeasurement, MeasurementPhoto } from '../lib/types';

type FormFields = {
  weight: string;
  bodyFat: string;
  muscle: string;
  height: string;
  waist: string;
  chest: string;
  hip: string;
  arm: string;
  thigh: string;
  bodyWater: string;
  visceralFat: string;
  restingHeartRate: string;
  notes: string;
};

const emptyForm: FormFields = {
  weight: '',
  bodyFat: '',
  muscle: '',
  height: '',
  waist: '',
  chest: '',
  hip: '',
  arm: '',
  thigh: '',
  bodyWater: '',
  visceralFat: '',
  restingHeartRate: '',
  notes: '',
};

function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const num = Number(trimmed.replace(',', '.'));
  return Number.isFinite(num) ? num : undefined;
}

function buildSparklineSeries(
  measurements: HealthMeasurement[],
  pick: (m: HealthMeasurement) => string | number | null | undefined,
) {
  return [...measurements]
    .reverse()
    .map((m) => ({ m, value: pick(m) }))
    .filter((entry) => entry.value != null && entry.value !== '')
    .slice(-6)
    .map(({ m, value }) => ({
      at: m.measuredAt,
      value: Number(value),
    }));
}

export function MeasurementsScreen({ session }: { session: AthleteSession }) {
  const [measurements, setMeasurements] = useState<HealthMeasurement[] | null>(null);
  const [photos, setPhotos] = useState<MeasurementPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [measurementData, photoData] = await Promise.all([
        fetchMeasurements(session.accessToken),
        fetchMeasurementPhotos(session.accessToken),
      ]);
      setMeasurements(measurementData.measurements);
      setPhotos(photoData.photos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ölçümler alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const sparklines = useMemo(() => {
    if (!measurements) {
      return { weight: [], bodyFat: [], waist: [] };
    }

    return {
      weight: buildSparklineSeries(measurements, (m) => m.weight),
      bodyFat: buildSparklineSeries(measurements, (m) => m.bodyFatPercentage),
      waist: buildSparklineSeries(measurements, (m) => m.waistCm),
    };
  }, [measurements]);

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
        weight: toNumber(form.weight),
        bodyFatPercentage: toNumber(form.bodyFat),
        muscleMass: toNumber(form.muscle),
        height: toNumber(form.height),
        waistCm: toNumber(form.waist),
        chestCm: toNumber(form.chest),
        hipCm: toNumber(form.hip),
        armCm: toNumber(form.arm),
        thighCm: toNumber(form.thigh),
        bodyWaterPercentage: toNumber(form.bodyWater),
        visceralFatRating: toNumber(form.visceralFat),
        restingHeartRate: toNumber(form.restingHeartRate),
        notes: form.notes || undefined,
      });
      setForm(emptyForm);
      setFormOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

      {sparklines.weight.length > 1 || sparklines.bodyFat.length > 1 || sparklines.waist.length > 1 ? (
        <Card>
          {sparklines.weight.length > 1 ? (
            <MeasurementSparkline label="Kilo trendi" points={sparklines.weight} unit="kg" />
          ) : null}
          {sparklines.bodyFat.length > 1 ? (
            <View style={{ marginTop: spacing.md }}>
              <MeasurementSparkline label="Yağ trendi" points={sparklines.bodyFat} unit="%" />
            </View>
          ) : null}
          {sparklines.waist.length > 1 ? (
            <View style={{ marginTop: spacing.md }}>
              <MeasurementSparkline label="Bel trendi" points={sparklines.waist} unit="cm" />
            </View>
          ) : null}
        </Card>
      ) : null}

      {formOpen ? (
        <Card>
          <LabeledInput icon="scale-outline" placeholder="Kilo (kg)" value={form.weight} onChangeText={(v) => updateField('weight', v)} />
          <LabeledInput icon="water-outline" placeholder="Yağ oranı (%)" value={form.bodyFat} onChangeText={(v) => updateField('bodyFat', v)} />
          <LabeledInput icon="fitness-outline" placeholder="Kas kütlesi (kg)" value={form.muscle} onChangeText={(v) => updateField('muscle', v)} />
          <LabeledInput icon="resize-outline" placeholder="Boy (cm)" value={form.height} onChangeText={(v) => updateField('height', v)} />
          <LabeledInput icon="ellipse-outline" placeholder="Bel (cm)" value={form.waist} onChangeText={(v) => updateField('waist', v)} />
          <LabeledInput icon="body-outline" placeholder="Göğüs (cm)" value={form.chest} onChangeText={(v) => updateField('chest', v)} />
          <LabeledInput icon="body-outline" placeholder="Kalça (cm)" value={form.hip} onChangeText={(v) => updateField('hip', v)} />
          <LabeledInput icon="barbell-outline" placeholder="Kol (cm)" value={form.arm} onChangeText={(v) => updateField('arm', v)} />
          <LabeledInput icon="walk-outline" placeholder="Uyluk (cm)" value={form.thigh} onChangeText={(v) => updateField('thigh', v)} />
          <LabeledInput icon="water-outline" placeholder="Vücut suyu (%)" value={form.bodyWater} onChangeText={(v) => updateField('bodyWater', v)} />
          <LabeledInput icon="pulse-outline" placeholder="Viseral yağ" value={form.visceralFat} onChangeText={(v) => updateField('visceralFat', v)} />
          <LabeledInput icon="heart-outline" placeholder="Dinlenme nabzı" value={form.restingHeartRate} onChangeText={(v) => updateField('restingHeartRate', v)} />
          <LabeledInput
            icon="document-text-outline"
            placeholder="Not (opsiyonel)"
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            keyboardType="default"
          />
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <View style={{ marginTop: spacing.xs }}>
            <Button label="Kaydet" onPress={handleSave} loading={saving} icon="checkmark-circle-outline" />
          </View>
        </Card>
      ) : null}

      {photos && photos.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>İlerleme Fotoğrafları</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.photoUrl }} style={styles.photoImage} contentFit="cover" />
                <Text style={styles.photoCaption}>{photo.angle}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.photoHint}>Yeni fotoğraf web panelinden yüklenebilir.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.photoHint}>İlerleme fotoğrafları web panelinden yüklenebilir.</Text>
        </Card>
      )}

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

      {measurements?.map((m) => {
        const bmi = computeBmi(
          m.weight != null ? Number(m.weight) : null,
          m.height != null ? Number(m.height) : null,
        );

        return (
          <Card key={m.id}>
            <Text style={styles.dateText}>
              {new Date(m.measuredAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.grid}>
              <Metric label="Kilo" value={m.weight != null ? `${m.weight} kg` : '—'} />
              <Metric label="Yağ" value={m.bodyFatPercentage != null ? `${m.bodyFatPercentage}%` : '—'} />
              <Metric label="Bel" value={m.waistCm != null ? `${m.waistCm} cm` : '—'} />
              <Metric label="BMI" value={bmi != null ? bmi.toFixed(1) : '—'} />
              <Metric label="Kas" value={m.muscleMass != null ? `${m.muscleMass} kg` : '—'} />
              <Metric label="Boy" value={m.height != null ? `${m.height} cm` : '—'} />
            </View>
            {m.notes ? <Text style={styles.notes}>{m.notes}</Text> : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.faint}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
  sectionTitle: { ...typography.subheading, color: colors.text, marginBottom: spacing.sm },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: spacing.sm },
  faint: { ...typography.caption, color: colors.faint },
  value: { ...typography.subheading, color: colors.text, marginTop: 2, fontSize: 13 },
  notes: { ...typography.caption, color: colors.muted, fontStyle: 'italic', marginTop: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoItem: { width: '47%', borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  photoImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.border },
  photoCaption: { ...typography.caption, color: colors.faint, padding: 6, textAlign: 'center' },
  photoHint: { ...typography.caption, color: colors.faint, marginTop: spacing.sm },
});
