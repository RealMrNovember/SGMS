import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, typography } from '../../lib/theme';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#241a08' : colors.gold} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={17}
              color={variant === 'primary' ? '#241a08' : colors.gold}
            />
          ) : null}
          <Text style={[styles.label, variant !== 'primary' && styles.labelOutline]}>{label}</Text>
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled || loading}
        haptic
        style={fullWidth ? styles.fullWidth : undefined}
      >
        <LinearGradient colors={gradients.gold} style={styles.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      style={fullWidth ? styles.fullWidth : undefined}
    >
      <View style={[styles.secondary, variant === 'ghost' && styles.ghost]}>{content}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primary: {
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSoft,
  },
  ghost: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  label: { ...typography.subheading, color: '#241a08' },
  labelOutline: { color: colors.gold },
});
