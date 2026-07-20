import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({
  name,
  uri,
  size = 52,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const dimension = { width: size, height: size, borderRadius: size };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimension]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <LinearGradient colors={gradients.gold} style={[styles.fallback, dimension]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  fallback: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  initials: { color: '#241a08', fontWeight: '700' },
});
