import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { login } from '../lib/api';
import { colors, gradients, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession } from '../lib/types';

export function LoginScreen({ onSuccess }: { onSuccess: (session: AthleteSession) => void }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  async function handleSubmit() {
    if (!email || !password) {
      setError('E-posta ve parola gerekli');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} style={styles.container}>
      <KeyboardAvoidingView
        style={[styles.flex, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brandWrap}>
          <LinearGradient colors={gradients.gold} style={styles.logo}>
            <Ionicons name="barbell" size={30} color="#241a08" />
          </LinearGradient>
          <Text style={styles.brand}>SGMS Sporcu</Text>
          <Text style={styles.subtitle}>Salon üyeliğinizi tek dokunuşla yönetin</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrap, focusedField === 'email' && styles.inputWrapFocused]}>
            <Ionicons name="mail-outline" size={18} color={colors.faint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.faint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Parola"
              placeholderTextColor={colors.faint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.faint}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.sm }}>
            <Button label="Giriş Yap" onPress={handleSubmit} loading={loading} icon="log-in-outline" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  brandWrap: { alignItems: 'center', marginBottom: spacing.xxl * 1.4 },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: { ...typography.title, fontSize: 26, color: colors.text, letterSpacing: 0.5 },
  subtitle: { ...typography.body, color: colors.muted, marginTop: spacing.xs, textAlign: 'center' },
  form: { gap: spacing.md },
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
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 14,
    fontSize: 15,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  error: { ...typography.caption, color: colors.danger },
});
