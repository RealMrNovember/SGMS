import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCheckInQr } from '../lib/api';
import { colors, gradients, radius, shadow, spacing, typography } from '../lib/theme';
import { PressableScale } from './ui/PressableScale';

const RING_SIZE = 40;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Salon girişi QR'ı artık ana sayfada otomatik açılmıyor — kullanıcı bilinçli
 * olarak "Salona Giriş Yap" butonuna basınca burada, tam ekran bir modalde
 * gösteriliyor. Süresi dolan token'ı sunucunun kendi `refreshAfterSeconds`
 * değerine göre otomatik yeniliyor (modal açıkken), kapatınca hiçbir isteği
 * arka planda tekrarlamıyor — bataryayı ve gereksiz token üretimini boşa harcamaz.
 */
export function CheckInQrModal({
  visible,
  accessToken,
  onClose,
}: {
  visible: boolean;
  accessToken: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const expiresAtRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    refreshTimerRef.current = null;
    tickRef.current = null;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchCheckInQr(accessToken);
      setToken(data.token);
      const refreshMs = Math.max(data.refreshAfterSeconds, 10) * 1000;
      expiresAtRef.current = Date.now() + refreshMs;
      setRemainingMs(refreshMs);
      setTotalMs(refreshMs);

      clearTimers();
      refreshTimerRef.current = setTimeout(() => void load(), refreshMs);
      tickRef.current = setInterval(() => {
        const left = (expiresAtRef.current ?? Date.now()) - Date.now();
        setRemainingMs(Math.max(left, 0));
      }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR kod alınamadı');
    } finally {
      setLoading(false);
    }
  }, [accessToken, clearTimers]);

  useEffect(() => {
    if (!visible) {
      clearTimers();
      setToken(null);
      setTotalMs(0);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void load();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fraction = totalMs > 0 ? Math.min(remainingMs / totalMs, 1) : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={[styles.backdrop, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <PressableScale onPress={onClose} style={styles.closeButton} haptic>
            <Ionicons name="close" size={22} color={colors.text} />
          </PressableScale>

          <View style={styles.centerArea}>
            <LinearGradient colors={gradients.qrHeader} style={styles.headerBadge}>
              <Ionicons name="scan-outline" size={20} color={colors.gold} />
              <Text style={styles.headerText}>Salon Girişi</Text>
            </LinearGradient>

            <View style={[styles.qrCard, shadow.floating]}>
              {token ? (
                <QRCode value={token} size={220} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  {loading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Ionicons name="alert-circle-outline" size={32} color={colors.faint} />
                  )}
                </View>
              )}
            </View>

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <Text style={styles.hint}>Kodu turnikedeki okuyucuya gösterin</Text>
            )}

            <View style={styles.ringRow}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={colors.border}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={colors.gold}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
                  rotation={-90}
                  originX={RING_SIZE / 2}
                  originY={RING_SIZE / 2}
                />
              </Svg>
              <Text style={styles.ringLabel}>Otomatik yenilenir</Text>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg },
  closeButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  headerText: { ...typography.subheading, color: colors.text },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  hint: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  ringRow: { alignItems: 'center', gap: 6 },
  ringLabel: { ...typography.tiny, color: colors.faint },
});
