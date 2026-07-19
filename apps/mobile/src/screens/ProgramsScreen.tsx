import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchPrograms } from '../lib/api';
import { colors } from '../lib/theme';
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
    >
      <Text style={styles.title}>Programlarım</Text>

      {programs === null && !error ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {programs && programs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Henüz atanmış bir programınız yok.</Text>
        </View>
      ) : null}

      {programs?.map((program) => {
        const summary = summarizeContent(program.content);
        return (
          <View key={program.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.programTitle}>{program.title}</Text>
              <View style={[styles.badge, !program.isActive && styles.badgeInactive]}>
                <Text style={styles.badgeText}>{program.isActive ? 'Aktif' : 'Pasif'}</Text>
              </View>
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
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  programTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 6 },
  faint: { color: colors.faint, fontSize: 12, marginTop: 4 },
  summary: { color: colors.text, fontSize: 13, marginTop: 10, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 16 },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(201,169,98,0.4)',
    backgroundColor: 'rgba(201,169,98,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeInactive: { opacity: 0.5 },
  badgeText: { color: colors.gold, fontSize: 10, fontWeight: '600' },
});
