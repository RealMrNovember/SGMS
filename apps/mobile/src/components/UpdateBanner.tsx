import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../lib/theme';
import { PressableScale } from './ui/PressableScale';
import type { UpdateInfo } from '../lib/types';

export function UpdateBanner({ update }: { update: UpdateInfo }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.textRow}>
        <Ionicons name="sparkles-outline" size={16} color={colors.cyan} />
        <Text style={styles.text}>Yeni sürüm hazır · v{update.version}</Text>
      </View>
      <PressableScale
        style={styles.button}
        haptic
        onPress={() => void Linking.openURL(update.downloadUrl)}
      >
        <Text style={styles.buttonText}>İndir</Text>
        <Ionicons name="download-outline" size={13} color={colors.bg} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56,189,248,0.3)',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  text: { ...typography.caption, color: colors.cyan, flexShrink: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cyan,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
});
