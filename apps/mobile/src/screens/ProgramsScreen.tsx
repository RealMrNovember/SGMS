import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { fetchPrograms } from '../lib/api';
import { colors, spacing, typography } from '../lib/theme';
import type { AthleteSession, TrainingProgram } from '../lib/types';

function summarizeContent(content: unknown): string | null {
  if (!content || typeof content !== 'object') return null;
  const obj = content as Record<string, unknown>;
  if (Array.isArray(obj.days)) {
    return `${obj.days.length} günlük plan`;
  }
  if (typeof obj.notes === 'string' && obj.notes.trim()) {
    return obj.notes;
  }
  return null;
}

export function ProgramsScreen({ session }: { session: AthleteSession }) {
  const [programs, setPrograms] = useState<TrainingProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchPrograms(session.accessToken);
      setPrograms(data.programs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Programlar alınamadı');
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Programlarım</Text>

      {programs === null && !error ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {programs && programs.length === 0 ? (
        <Card>
          <EmptyState
            icon="barbell-outline"
            title="Henüz program atanmamış"
            subtitle="Antrenörünüz size bir program tanımladığında burada görünecek."
          />
        </Card>
      ) : null}

      {programs?.map((program) => {
        const summary = summarizeContent(program.content);
        return (
          <Card key={program.id}>
            <View style={styles.rowBetween}>
              <View style={styles.titleRow}>
                <Ionicons
                  name={program.type === 'WORKOUT' ? 'barbell-outline' : 'nutrition-outline'}
                  size={16}
                  color={colors.gold}
                />
                <Text style={styles.programTitle}>{program.title}</Text>
              </View>
              <Badge label={program.isActive ? 'Aktif' : 'Pasif'} tone={program.isActive ? 'success' : 'neutral'} />
            </View>
            <Text style={styles.muted}>
              {program.type === 'WORKOUT' ? 'Antrenman' : 'Beslenme'} ·{' '}
              {new Date(program.startDate).toLocaleDateString('tr-TR')}
              {program.endDate ? ` – ${new Date(program.endDate).toLocaleDateString('tr-TR')}` : ''}
            </Text>
            <Text style={styles.faint}>
              Antrenör: {program.trainer?.name ?? program.trainer?.email ?? 'Belirtilmemiş'}
            </Text>
            {summary ? <Text style={styles.summary}>{summary}</Text> : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  title: { ...typography.title, color: colors.text, marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  programTitle: { ...typography.subheading, color: colors.text, flexShrink: 1 },
  muted: { ...typography.body, color: colors.muted, marginTop: 8 },
  faint: { ...typography.caption, color: colors.faint, marginTop: 4 },
  summary: { ...typography.body, color: colors.text, marginTop: 10, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 16 },
});
