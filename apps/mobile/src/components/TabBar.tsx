import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../lib/theme';
import { PressableScale } from './ui/PressableScale';

export type TabKey = 'home' | 'programs' | 'measurements' | 'messages' | 'account';

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home-outline', iconActive: 'home' },
  { key: 'programs', label: 'Program', icon: 'barbell-outline', iconActive: 'barbell' },
  { key: 'measurements', label: 'Ölçüm', icon: 'pulse-outline', iconActive: 'pulse' },
  { key: 'messages', label: 'Mesaj', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { key: 'account', label: 'Hesabım', icon: 'person-outline', iconActive: 'person' },
];

export function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  badges?: Partial<Record<TabKey, number>>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const badge = badges?.[tab.key];
        return (
          <PressableScale key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons name={isActive ? tab.iconActive : tab.icon} size={20} color={isActive ? colors.gold : colors.faint} />
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.goldSoft },
  label: { ...typography.tiny, color: colors.faint },
  labelActive: { color: colors.gold },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.bgElevated,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
