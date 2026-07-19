import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../lib/theme';
import type { UpdateInfo } from '../lib/types';

export function UpdateBanner({ update }: { update: UpdateInfo }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Yeni sürüm hazır · v{update.version}</Text>
      <TouchableOpacity style={styles.button} onPress={() => void Linking.openURL(update.downloadUrl)}>
        <Text style={styles.buttonText}>İndir ve Güncelle</Text>
      </TouchableOpacity>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  text: { color: colors.cyan, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  button: { backgroundColor: colors.cyan, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  buttonText: { color: '#0b1220', fontSize: 11, fontWeight: '700' },
});
