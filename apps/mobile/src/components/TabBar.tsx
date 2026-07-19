import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../lib/theme';

export type TabKey = 'home' | 'programs' | 'measurements' | 'messages' | 'account';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Ana Sayfa', icon: '⌂' },
  { key: 'programs', label: 'Program', icon: '▤' },
  { key: 'measurements', label: 'Ölçüm', icon: '◐' },
  { key: 'messages', label: 'Mesaj', icon: '✉' },
  { key: 'account', label: 'Hesabım', icon: '◉' },
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
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const badge = badges?.[tab.key];
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <View>
              <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 6,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20, color: colors.faint },
  iconActive: { color: colors.gold },
  label: { fontSize: 10, color: colors.faint },
  labelActive: { color: colors.gold, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#0b1220', fontSize: 9, fontWeight: '700' },
});
