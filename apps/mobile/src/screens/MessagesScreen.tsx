import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { PressableScale } from '../components/ui/PressableScale';
import { fetchMe, fetchMessages, sendMessage } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, DirectMessage } from '../lib/types';

type Peer = {
  id: string;
  name: string;
  subtitle: string;
  kind: 'trainer' | 'reception';
};

export function MessagesScreen({ session }: { session: AthleteSession }) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const activePeer = peers.find((p) => p.id === activePeerId) ?? null;

  const loadThread = useCallback(
    async (peerId: string) => {
      try {
        const [inbox, sent] = await Promise.all([
          fetchMessages(session.accessToken, 'inbox'),
          fetchMessages(session.accessToken, 'sent'),
        ]);
        const combined = [...inbox.messages, ...sent.messages].filter(
          (m) => m.senderId === peerId || m.receiverId === peerId,
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
        const nextPeers: Peer[] = [];
        if (me.gymMember.trainer) {
          nextPeers.push({
            id: me.gymMember.trainer.id,
            name: me.gymMember.trainer.name ?? me.gymMember.trainer.email,
            subtitle: 'Antrenörünüz',
            kind: 'trainer',
          });
        }
        if (me.receptionOnDuty) {
          nextPeers.push({
            id: me.receptionOnDuty.id,
            name: me.receptionOnDuty.name,
            subtitle:
              me.receptionOnDuty.source === 'open_shift'
                ? 'Resepsiyon · mesaide'
                : 'Resepsiyon',
            kind: 'reception',
          });
        }
        setPeers(nextPeers);
        const initialId = nextPeers[0]?.id ?? null;
        setActivePeerId(initialId);
        if (initialId) {
          await loadThread(initialId);
          interval = setInterval(() => {
            setActivePeerId((current) => {
              if (current) void loadThread(current);
              return current;
            });
          }, 15000);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kişiler yüklenemedi');
        setLoading(false);
      }
    })();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.accessToken, loadThread]);

  async function selectPeer(peerId: string) {
    setActivePeerId(peerId);
    setDraft('');
    setLoading(true);
    await loadThread(peerId);
    setLoading(false);
  }

  async function handleSend() {
    if (!activePeer || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(session.accessToken, activePeer.id, draft.trim());
      setDraft('');
      await loadThread(activePeer.id);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  }

  if (loading && peers.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (peers.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Henüz yazılacak kimse yok"
          subtitle="Antrenör atandığında veya resepsiyon vardiyası açıldığında burada mesajlaşabilirsiniz."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.peerRow}
      >
        {peers.map((peer) => {
          const selected = peer.id === activePeerId;
          return (
            <PressableScale
              key={peer.id}
              onPress={() => void selectPeer(peer.id)}
              style={[styles.peerChip, selected && styles.peerChipActive]}
            >
              <Avatar name={peer.name} size={28} />
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.peerName, selected && styles.peerNameActive]} numberOfLines={1}>
                  {peer.name}
                </Text>
                <Text style={styles.peerSub} numberOfLines={1}>
                  {peer.subtitle}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {activePeer ? (
        <View style={styles.header}>
          <Avatar name={activePeer.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{activePeer.name}</Text>
            <Text style={styles.faint}>{activePeer.subtitle}</Text>
          </View>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Henüz mesaj yok"
            subtitle="İlk mesajı siz gönderin."
          />
        }
        renderItem={({ item }) => {
          const isMine = item.senderId === session.user.id;
          return (
            <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                <Text style={[styles.bubbleTime, isMine && styles.bubbleTextMine]}>
                  {new Date(item.createdAt).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
        <PressableScale
          onPress={handleSend}
          disabled={sending || !draft.trim() || !activePeer}
          haptic
          style={styles.sendButton}
        >
          {sending ? (
            <ActivityIndicator color="#241a08" />
          ) : (
            <Ionicons name="send" size={17} color="#241a08" />
          )}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  peerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  peerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 180,
  },
  peerChipActive: { borderColor: colors.goldBorder, backgroundColor: 'rgba(201,169,98,0.12)' },
  peerName: { ...typography.caption, color: colors.text, fontWeight: '600' },
  peerNameActive: { color: colors.gold },
  peerSub: { ...typography.caption, color: colors.faint, fontSize: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.subheading, color: colors.text },
  faint: { ...typography.caption, color: colors.faint, marginTop: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 19 },
  bubbleTextMine: { color: '#241a08' },
  bubbleTime: { color: colors.faint, fontSize: 10, marginTop: 4, textAlign: 'right' },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center', paddingBottom: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
