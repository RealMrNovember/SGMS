import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fetchEvents, rsvpEvent } from '../lib/api';
import { colors, spacing, typography } from '../lib/theme';
import type { AthleteSession, GymEvent } from '../lib/types';

const EVENT_TYPE_LABEL: Record<GymEvent['eventType'], string> = {
  WALK: 'Yürüyüş',
  RUN: 'Koşu',
  SPORT: 'Spor Etkinliği',
  OTHER: 'Etkinlik',
};

export function EventsScreen({ session, onBack }: { session: AthleteSession; onBack: () => void }) {
  const [events, setEvents] = useState<GymEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents(session.accessToken);
      setEvents(data.events);
    } catch {
      setError('Etkinlikler yüklenemedi.');
    }
  }, [session.accessToken]);

  useEffect(() => {
    setLoading(true);
    void loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  async function handleRsvp(eventId: string, going: boolean) {
    setBusyId(eventId);
    setError(null);
    try {
      await rsvpEvent(session.accessToken, eventId, going);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setBusyId(null);
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
        <Text style={styles.title}>Etkinlikler</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {events.length === 0 ? (
        <Card>
          <Text style={styles.hint}>Şu an yaklaşan bir salon etkinliği yok.</Text>
        </Card>
      ) : (
        events.map((event) => {
          const going = event.myStatus === 'GOING';
          const startDate = new Date(event.startsAt);
          return (
            <Card key={event.id}>
              <View style={styles.rowBetween}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Badge label={EVENT_TYPE_LABEL[event.eventType]} tone="gold" />
              </View>
              <Text style={styles.meta}>
                {startDate.toLocaleDateString('tr-TR')} · {startDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                {event.location ? ` · ${event.location}` : ''}
              </Text>
              {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
              <Text style={styles.meta}>{event.goingCount} kişi katılıyor</Text>

              <View style={{ marginTop: spacing.md }}>
                {going ? (
                  <Button
                    label="Katılımı iptal et"
                    variant="ghost"
                    onPress={() => handleRsvp(event.id, false)}
                    loading={busyId === event.id}
                  />
                ) : (
                  <Button
                    label="Katılıyorum"
                    icon="checkmark-circle-outline"
                    onPress={() => handleRsvp(event.id, true)}
                    loading={busyId === event.id}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hint: { ...typography.body, color: colors.muted },
  eventTitle: { ...typography.subheading, color: colors.text, flex: 1, marginRight: spacing.sm },
  meta: { ...typography.caption, color: colors.muted, marginTop: 6 },
  description: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  error: { color: '#fca5a5', ...typography.caption },
});
