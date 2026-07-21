import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { createFoodLogEntry, deleteFoodLogEntry, fetchNutritionOverview } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, MealType, NutritionOverview } from '../lib/types';

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Kahvaltı',
  LUNCH: 'Öğle Yemeği',
  DINNER: 'Akşam Yemeği',
  SNACK: 'Ara Öğün',
};

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

// Salonun kendi saat dilimini kullanır (backend'den `overview.timeZone` ile gelir) —
// Istanbul dışındaki bir şubede gece geç saatte girilen bir öğün yanlış güne sayılmasın.
function todayKeyInTimeZone(timeZone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

export function NutritionScreen({ session, onBack }: { session: AthleteSession; onBack: () => void }) {
  const [overview, setOverview] = useState<NutritionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNutritionOverview(session.accessToken);
      setOverview(data);
    } catch {
      setError('Beslenme günlüğü yüklenemedi.');
    }
  }, [session.accessToken]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleCreate() {
    if (!foodName.trim()) {
      setError('Yiyecek/içecek adını yazın.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createFoodLogEntry(session.accessToken, {
        mealType,
        foodName: foodName.trim(),
        calories: calories ? Number(calories.replace(',', '.')) : undefined,
        proteinG: proteinG ? Number(proteinG.replace(',', '.')) : undefined,
        carbsG: carbsG ? Number(carbsG.replace(',', '.')) : undefined,
        fatG: fatG ? Number(fatG.replace(',', '.')) : undefined,
        notes: notes.trim() || undefined,
      });
      setMessage('Öğün kaydedildi.');
      setFoodName('');
      setCalories('');
      setProteinG('');
      setCarbsG('');
      setFatG('');
      setNotes('');
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Öğün kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await deleteFoodLogEntry(session.accessToken, entryId);
      setMessage('Kayıt silindi.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi.');
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

  const todayTotal = overview
    ? (overview.days.find((d) => d.dateKey === todayKeyInTimeZone(overview.timeZone))?.totalCalories ?? 0)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
    >
      <View style={styles.headerRow}>
        <Button label="Geri" variant="ghost" icon="arrow-back-outline" onPress={onBack} />
        <Text style={styles.title}>Beslenme</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Card>
        <Text style={styles.label}>Bugünkü toplam</Text>
        <Text style={styles.todayCalories}>{todayTotal} kcal</Text>
        {overview?.plannedDailyCalories != null ? (
          <Text style={styles.hint}>
            Hedef {overview.plannedDailyCalories} kcal
            {overview.activeProgramTitle ? ` (${overview.activeProgramTitle})` : ''}
          </Text>
        ) : (
          <Text style={styles.hint}>PT'iniz henüz bir beslenme hedefi belirlemedi.</Text>
        )}
      </Card>

      {formOpen ? (
        <Card>
          <Text style={styles.sectionTitle}>Yeni öğün</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Öğün</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((type) => (
                <TypeChip
                  key={type}
                  label={MEAL_TYPE_LABEL[type]}
                  active={mealType === type}
                  onPress={() => setMealType(type)}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Yiyecek/içecek</Text>
            <TextInput
              value={foodName}
              onChangeText={setFoodName}
              placeholder="örn. Izgara tavuk + salata"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Kalori (kcal)</Text>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                placeholder="opsiyonel"
                placeholderTextColor={colors.faint}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Protein (g)</Text>
              <TextInput
                value={proteinG}
                onChangeText={setProteinG}
                placeholder="opsiyonel"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Karbonhidrat (g)</Text>
              <TextInput
                value={carbsG}
                onChangeText={setCarbsG}
                placeholder="opsiyonel"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Yağ (g)</Text>
              <TextInput
                value={fatG}
                onChangeText={setFatG}
                placeholder="opsiyonel"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Not (opsiyonel)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="örn. Dışarıda yedim"
              placeholderTextColor={colors.faint}
              multiline
              style={styles.textarea}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button label="Kaydet" onPress={handleCreate} loading={submitting} />
            <Button label="Vazgeç" variant="ghost" onPress={() => setFormOpen(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Öğün ekle" icon="add-circle-outline" onPress={() => setFormOpen(true)} />
      )}

      {!overview || overview.days.length === 0 ? (
        <Card>
          <Text style={styles.hint}>Henüz öğün kaydı yok.</Text>
        </Card>
      ) : (
        overview.days.map((day) => (
          <Card key={day.dateKey}>
            <View style={styles.rowBetween}>
              <Text style={styles.dayTitle}>{day.dateKey}</Text>
              <Text style={styles.dayTotal}>{day.totalCalories} kcal</Text>
            </View>
            {day.entries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>
                    {MEAL_TYPE_LABEL[entry.mealType]} · {entry.foodName}
                  </Text>
                  <Text style={styles.hint}>
                    {entry.calories != null ? `${entry.calories} kcal` : 'Kalori girilmedi'}
                    {entry.proteinG != null ? ` · P ${entry.proteinG}g` : ''}
                    {entry.carbsG != null ? ` · K ${entry.carbsG}g` : ''}
                    {entry.fatG != null ? ` · Y ${entry.fatG}g` : ''}
                  </Text>
                </View>
                <Button label="Sil" variant="ghost" onPress={() => handleDelete(entry.id)} loading={submitting} />
              </View>
            ))}
          </Card>
        ))
      )}
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
  sectionTitle: { ...typography.subheading, color: colors.text, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  hint: { ...typography.caption, color: colors.muted, marginTop: 4 },
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
  todayCalories: { ...typography.title, color: colors.gold, marginTop: 4 },
  dayTitle: { ...typography.subheading, color: colors.text },
  dayTotal: { ...typography.caption, color: colors.muted },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  entryTitle: { ...typography.body, color: colors.text },
  error: { color: '#fca5a5', ...typography.caption },
  success: { color: '#86efac', ...typography.caption },
});
