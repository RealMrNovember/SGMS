import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { login } from '../lib/api';
import type { AthleteSession } from '../lib/types';

export function LoginScreen({ onSuccess }: { onSuccess: (session: AthleteSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) {
      setError('E-posta ve parola gerekli');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>SGMS</Text>
      <Text style={styles.subtitle}>Sporcu Girişi</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Parola"
          placeholderTextColor="#64748b"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0b1220" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  brand: {
    fontSize: 34,
    fontWeight: '700',
    color: '#c9a962',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 36,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#111a2b',
    color: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#c9a962',
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0b1220',
    fontWeight: '700',
    fontSize: 15,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
});
