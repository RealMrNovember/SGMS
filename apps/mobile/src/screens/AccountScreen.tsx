import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchMe, fetchStatement, logout } from '../lib/api';
import { clearSession } from '../lib/storage';
import { colors } from '../lib/theme';
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

  const balanceEntries = statement ? Object.entries(statement.balancesByCurrency).filter(([, v]) => v > 0) : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
    >
      <Text style={styles.title}>Hesabım</Text>

      {!me && !error ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {me ? (
        <View style={styles.card}>
          <Text style={styles.name}>
            {me.gymMember.firstName} {me.gymMember.lastName}
          </Text>
          <Text style={styles.muted}>{me.user.email}</Text>
          {me.gymMember.phone ? <Text style={styles.muted}>{me.gymMember.phone}</Text> : null}
          <View style={styles.rowBetween}>
            <Text style={styles.faint}>Üyelik Planı</Text>
            <Text style={styles.value}>{me.gymMember.plan?.name ?? '—'}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.faint}>Durum</Text>
            <Text style={styles.value}>{me.gymMember.status}</Text>
          </View>
          {me.gymMember.membershipEndsAt ? (
            <View style={styles.rowBetween}>
              <Text style={styles.faint}>Üyelik Bitiş</Text>
              <Text style={styles.value}>
                {new Date(me.gymMember.membershipEndsAt).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bakiye</Text>
        {balanceEntries.length === 0 ? (
          <Text style={styles.balancePositive}>Borcunuz yok</Text>
        ) : (
          balanceEntries.map(([code, amount]) => (
            <Text key={code} style={styles.balanceNegative}>
              {money(amount, code)}
            </Text>
          ))
        )}
        {balanceEntries.length > 0 ? <Text style={styles.faint}>Ödemenizi resepsiyonda yapabilirsiniz</Text> : null}
      </View>

      {statement && statement.paymentPlans.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ödeme Planı</Text>
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
        </View>
      ) : null}

      {statement && statement.recentTransactions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Son Ödemeler</Text>
          {statement.recentTransactions.slice(0, 10).map((tx) => (
            <View key={tx.id} style={styles.rowBetween}>
              <Text style={styles.muted}>
                {tx.type} · {new Date(tx.createdAt).toLocaleDateString('tr-TR')}
              </Text>
              <Text style={styles.balancePositive}>{money(tx.amount, tx.currency)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {statement && statement.recentExpenses.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Son İşlemler</Text>
          {statement.recentExpenses.slice(0, 10).map((expense) => (
            <View key={expense.id} style={styles.rowBetween}>
              <Text style={styles.muted}>
                {expense.description ?? expense.category ?? '—'} ·{' '}
                {new Date(expense.createdAt).toLocaleDateString('tr-TR')}
              </Text>
              <Text style={styles.value}>{money(expense.amount, expense.currency)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.logoutText}>Çıkış Yap</Text>}
      </TouchableOpacity>

      <Text style={styles.versionText}>SGMS Sporcu v{getCurrentVersion()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  faint: { color: colors.faint, fontSize: 12 },
  value: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  balancePositive: { color: colors.success, fontSize: 16, fontWeight: '700' },
  balanceNegative: { color: '#fbbf24', fontSize: 18, fontWeight: '700' },
  planBlock: { gap: 6, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 16 },
  logoutButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  versionText: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: 4 },
});
