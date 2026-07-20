import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../../lib/theme';

type Tone = 'gold' | 'success' | 'danger' | 'neutral';

const TONE_STYLES: Record<Tone, { bg: string; border: string; text: string }> = {
  gold: { bg: colors.goldSoft, border: colors.goldBorder, text: colors.gold },
  success: { bg: colors.successSoft, border: 'rgba(52,211,153,0.35)', text: colors.success },
  danger: { bg: colors.dangerSoft, border: 'rgba(248,113,113,0.35)', text: colors.danger },
  neutral: { bg: 'rgba(148,163,184,0.12)', border: colors.border, text: colors.muted },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: { ...typography.tiny },
});
