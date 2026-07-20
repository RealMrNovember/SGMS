import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fetchMe, fetchStatement, logout, startMembershipRenewal } from '../lib/api';
import { clearSession } from '../lib/storage';
import { colors, spacing, typography } from '../lib/theme';
import { getCurrentVersion } from '../lib/update-check';
import type { AthleteSession, MeResponse, MemberStatement } from '../lib/types';

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function AccountScreen({ session, onLogout }: { session: AthleteSession; onLogout: () => void }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [statement, setStatement] = useState<MemberStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meData, statementData] = await Promise.all([
        fetchMe(session.accessToken),
        fetchStatement(session.accessToken),
      ]);
      setMe(meData);
      setStatement(statementData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap bilgileri alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout(session.accessToken);
    await clearSession();
    onLogout();
  }

  async function handleRenew() {
    setRenewing(true);
    setRenewError(null);
    try {
      const result = await startMembershipRenewal(session.accessToken);
      if ('renewedImmediately' in result) {
        Alert.alert('Üyelik yenilendi', 'Ücretsiz paketiniz uzatıldı.');
        await load();
      } else {
        await Linking.openURL(result.checkoutUrl);
      }
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : 'Yenileme başlatılamadı');
    } finally {
      setRenewing(false);
    }
  }

  const balanceEntries = statement ? Object.entries(statement.balancesByCurrency).filter(([, v]) => v > 0) : [];
  const fullName = me ? `${me.gymMember.firstName} ${me.gymMember.lastName}` : session.user.name;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Hesabım</Text>

      {me ? (
        <Card>
          <View style={styles.profileRow}>
            <Avatar name={fullName} uri={me.gymMember.avatarUrl} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.muted}>{me.user.email}</Text>
              {me.gymMember.phone ? <Text style={styles.faint}>{me.gymMember.phone}</Text> : null}
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow icon="ribbon-outline" label="Üyelik Planı" value={me.gymMember.plan?.name ?? '—'} />
          <InfoRow icon="pulse-outline" label="Durum" value={<Badge label={me.gymMember.status} tone="gold" />} />
          {me.gymMember.membershipEndsAt ? (
            <InfoRow
              icon="calendar-outline"
              label="Üyelik Bitiş"
              value={new Date(me.gymMember.membershipEndsAt).toLocaleDateString('tr-TR')}
            />
          ) : null}

          {me.gymMember.plan ? (
            <View style={styles.renewBlock}>
              <Button
                label="Üyeliğimi Yenile"
                onPress={handleRenew}
                loading={renewing}
                variant="secondary"
                icon="refresh-outline"
              />
              {renewError ? <Text style={styles.renewError}>{renewError}</Text> : null}
            </View>
          ) : null}
        </Card>
      ) : (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
      )}

      <Card>
        <View style={styles.balanceHeader}>
          <Ionicons name="wallet-outline" size={18} color={colors.gold} />
          <Text style={styles.sectionTitle}>Bakiye</Text>
        </View>
        {balanceEntries.length === 0 ? (
          <View style={styles.balancePositiveWrap}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.balancePositive}>Borcunuz yok</Text>
          </View>
        ) : (
          balanceEntries.map(([code, amount]) => (
            <Text key={code} style={styles.balanceNegative}>
              {money(amount, code)}
            </Text>
          ))
        )}
        {balanceEntries.length > 0 ? <Text style={styles.faint}>Ödemenizi resepsiyonda yapabilirsiniz</Text> : null}
      </Card>

      {statement && statement.paymentPlans.length > 0 ? (
        <Card>
          <View style={styles.balanceHeader}>
            <Ionicons name="calendar-number-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Ödeme Planı</Text>
          </View>
          {statement.paymentPlans.map((plan) => (
            <View key={plan.id} style={styles.planBlock}>
              <Text style={styles.faint}>{plan.installmentCount} taksit</Text>
              {plan.installments.map((inst, idx) => (
                <View key={inst.id} style={styles.rowBetween}>
                  <Text style={styles.muted}>
                    {idx + 1}/{plan.installmentCount}
                    {inst.dueDate ? ` · ${new Date(inst.dueDate).toLocaleDateString('tr-TR')}` : ''}
                  </Text>
                  <Text style={styles.value}>
                    {inst.paidAmount.toFixed(0)} / {inst.amount.toFixed(0)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      {statement && statement.recentTransactions.length > 0 ? (
        <Card>
          <View style={styles.balanceHeader}>
            <Ionicons name="swap-horizontal-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Son Ödemeler</Text>
          </View>
          {statement.recentTransactions.slice(0, 10).map((tx) => (
            <View key={tx.id} style={styles.rowBetween}>
              <Text style={styles.muted}>
                {tx.type} · {new Date(tx.createdAt).toLocaleDateString('tr-TR')}
              </Text>
              <Text style={styles.balancePositiveInline}>{money(tx.amount, tx.currency)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="Çıkış Yap" onPress={handleLogout} loading={loggingOut} variant="ghost" icon="log-out-outline" />

      <Text style={styles.versionText}>SGMS Sporcu v{getCurrentVersion()}</Text>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelRow}>
        <Ionicons name={icon} size={15} color={colors.faint} />
        <Text style={styles.faint}>{label}</Text>
      </View>
      {typeof value === 'string' ? <Text style={styles.value}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  title: { ...typography.title, color: colors.text },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...typography.heading, color: colors.text },
  muted: { ...typography.body, color: colors.muted, marginTop: 3 },
  faint: { ...typography.caption, color: colors.faint, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  renewBlock: { marginTop: spacing.md, gap: spacing.xs },
  renewError: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { ...typography.subheading, color: colors.text },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { ...typography.subheading, color: colors.text },
  balancePositiveWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balancePositive: { color: colors.success, fontSize: 16, fontWeight: '700' },
  balancePositiveInline: { color: colors.success, fontSize: 13, fontWeight: '700' },
  balanceNegative: { color: '#fbbf24', fontSize: 20, fontWeight: '700' },
  planBlock: { gap: 6, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 4 },
  versionText: { ...typography.tiny, color: colors.faint, textAlign: 'center', marginTop: spacing.xs },
});
