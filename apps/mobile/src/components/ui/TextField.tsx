import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../lib/theme';

/**
 * LoginScreen'deki ikon + focus-halkası deseninin yeniden kullanılabilir hali
 * (Faz 38) — hesap düzenleme formlarında aynı stili tekrar yazmamak için.
 */
export function TextField({
  icon,
  label,
  secureToggle,
  keyboardType,
  ...rest
}: TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  secureToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureToggle));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Ionicons name={icon} size={18} color={colors.faint} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardType}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {secureToggle ? (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.faint} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.muted },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  inputWrapFocused: { borderColor: colors.goldBorder },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    fontSize: 15,
  },
});
