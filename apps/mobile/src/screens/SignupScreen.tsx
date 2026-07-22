import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { signup } from '../lib/api';
import { colors, gradients, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession } from '../lib/types';

type Props = {
  onSuccess: (session: AthleteSession) => void;
  onBackToLogin: () => void;
};

export function SignupScreen({ onSuccess, onBackToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!organizationSlug.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8) {
      setError('Salon kodu, ad, soyad, e-posta ve en az 8 karakter parola gerekli.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await signup({
        organizationSlug: organizationSlug.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>Yeni sporcu hesabı</Text>
          <Text style={styles.subtitle}>Salon kodunuzla kayıt olun, ardından paket satın alın</Text>

          <View style={styles.form}>
            <Field
              icon="business-outline"
              placeholder="Salon kodu (slug)"
              value={organizationSlug}
              onChangeText={setOrganizationSlug}
              autoCapitalize="none"
            />
            <Field icon="person-outline" placeholder="Ad" value={firstName} onChangeText={setFirstName} />
            <Field icon="person-outline" placeholder="Soyad" value={lastName} onChangeText={setLastName} />
            <Field
              icon="mail-outline"
              placeholder="E-posta"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              icon="call-outline"
              placeholder="Telefon (opsiyonel)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Parola (min. 8)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Button label="Kayıt Ol" onPress={handleSubmit} loading={loading} icon="person-add-outline" />
            <TouchableOpacity onPress={onBackToLogin} style={styles.switch}>
              <Text style={styles.switchText}>Zaten hesabım var — Giriş yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Field(props: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={props.icon} size={18} color={colors.faint} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl },
  brand: { ...typography.title, fontSize: 24, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
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
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 15 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { ...typography.caption, color: colors.danger, flex: 1 },
  switch: { alignItems: 'center', paddingVertical: spacing.sm },
  switchText: { ...typography.caption, color: colors.gold },
});
