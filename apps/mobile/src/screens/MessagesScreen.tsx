import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchMe, fetchMessages, sendMessage } from '../lib/api';
import { colors } from '../lib/theme';
import type { AthleteSession, DirectMessage } from '../lib/types';

export function MessagesScreen({ session }: { session: AthleteSession }) {
  const [trainer, setTrainer] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadThread = useCallback(
    async (trainerId: string) => {
      try {
        const [inbox, sent] = await Promise.all([
          fetchMessages(session.accessToken, 'inbox'),
          fetchMessages(session.accessToken, 'sent'),
        ]);
        const combined = [...inbox.messages, ...sent.messages].filter(
          (m) => m.senderId === trainerId || m.receiverId === trainerId,
        );
        combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(combined);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Mesajlar alınamadı');
      }
    },
    [session.accessToken],
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const me = await fetchMe(session.accessToken);
        if (!me.gymMember.trainer) {
          setLoading(false);
          return;
        }
        setTrainer({ id: me.gymMember.trainer.id, name: me.gymMember.trainer.name ?? me.gymMember.trainer.email });
        await loadThread(me.gymMember.trainer.id);
        setLoading(false);
        interval = setInterval(() => void loadThread(me.gymMember.trainer!.id), 15000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Antrenör bilgisi alınamadı');
        setLoading(false);
      }
    })();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.accessToken, loadThread]);

  async function handleSend() {
    if (!trainer || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(session.accessToken, trainer.id, draft.trim());
      setDraft('');
      await loadThread(trainer.id);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!trainer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Henüz atanmış bir antrenörünüz yok.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{trainer.name}</Text>
        <Text style={styles.faint}>Antrenörünüz</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.muted}>Henüz mesaj yok. İlk mesajı siz gönderin.</Text>}
        renderItem={({ item }) => {
          const isMine = item.senderId === session.user.id;
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                <Text style={[styles.bubbleTime, isMine && styles.bubbleTextMine]}>
                  {new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yazın…"
          placeholderTextColor={colors.faint}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
          {sending ? <ActivityIndicator color="#0b1220" /> : <Text style={styles.sendButtonText}>Gönder</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  faint: { color: colors.faint, fontSize: 12, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 14 },
  bubbleTextMine: { color: '#0b1220' },
  bubbleTime: { color: colors.faint, fontSize: 10, marginTop: 4, textAlign: 'right' },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center', paddingBottom: 4 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendButtonText: { color: '#0b1220', fontWeight: '700', fontSize: 13 },
});
