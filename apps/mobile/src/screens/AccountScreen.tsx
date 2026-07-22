import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextField } from '../components/ui/TextField';
import {
  changePassword,
  fetchMe,
  fetchPublicGym,
  fetchStatement,
  logout,
  startMembershipRenewal,
  updateProfile,
  type PublicGymPlan,
} from '../lib/api';
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
  const [availablePlans, setAvailablePlans] = useState<PublicGymPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);

  const seededRef = useRef(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meData, statementData] = await Promise.all([
        fetchMe(session.accessToken),
        fetchStatement(session.accessToken),
      ]);
      setMe(meData);
      setStatement(statementData);
      setError(null);
      if (!seededRef.current) {
        seededRef.current = true;
        setEditName(meData.user.name ?? '');
        setEditPhone(meData.gymMember.phone ?? '');
        setEditEmail(meData.user.email ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap bilgileri alınamadı');
    }
  }, [session.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!me || me.gymMember.plan) {
      setAvailablePlans([]);
      return;
    }
    setPlansLoading(true);
    fetchPublicGym(me.organization.slug)
      .then((data) => setAvailablePlans(data.plans))
      .catch(() => setAvailablePlans([]))
      .finally(() => setPlansLoading(false));
  }, [me]);

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

  async function handleRenew(planId?: string) {
    setRenewing(true);
    setBuyingPlanId(planId ?? null);
    setRenewError(null);
    try {
      const result = await startMembershipRenewal(session.accessToken, planId);
      if ('renewedImmediately' in result) {
        Alert.alert(planId ? 'Üyelik aktif' : 'Üyelik yenilendi', 'Paketiniz başarıyla işlendi.');
        await load();
      } else {
        await Linking.openURL(result.checkoutUrl);
      }
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : 'İşlem başlatılamadı');
    } finally {
      setRenewing(false);
      setBuyingPlanId(null);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      await updateProfile(session.accessToken, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
      });
      setProfileSuccess('Bilgileriniz güncellendi.');
      await load();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Güncellenemedi');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError('Yeni parolalar eşleşmiyor.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await changePassword(session.accessToken, {
        currentPassword,
        newPassword,
        newPasswordConfirmation,
      });
      setPasswordSuccess('Parolanız güncellendi.');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Parola güncellenemedi');
    } finally {
      setPasswordSaving(false);
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
                onPress={() => handleRenew()}
                loading={renewing}
                variant="secondary"
                icon="refresh-outline"
              />
              {renewError ? <Text style={styles.renewError}>{renewError}</Text> : null}
            </View>
          ) : (
            <View style={styles.renewBlock}>
              <Text style={styles.muted}>Henüz paketiniz yok — aşağıdan seçip satın alın.</Text>
              {plansLoading ? <ActivityIndicator color={colors.gold} /> : null}
              {availablePlans.map((plan) => (
                <Button
                  key={plan.id}
                  label={`${plan.name} · ${money(plan.price, plan.currency)} · ${plan.durationDays} gün`}
                  onPress={() => handleRenew(plan.id)}
                  loading={buyingPlanId === plan.id}
                  variant="secondary"
                  icon="cart-outline"
                />
              ))}
              {!plansLoading && availablePlans.length === 0 ? (
                <Text style={styles.renewError}>Bu salon için satışta paket yok.</Text>
              ) : null}
              {renewError ? <Text style={styles.renewError}>{renewError}</Text> : null}
            </View>
          )}
        </Card>
      ) : (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
      )}

      <Card>
        <View style={styles.balanceHeader}>
          <Ionicons name="person-circle-outline" size={18} color={colors.gold} />
          <Text style={styles.sectionTitle}>Profili Düzenle</Text>
        </View>
        <View style={styles.formGap}>
          <TextField icon="person-outline" label="Ad Soyad" value={editName} onChangeText={setEditName} />
          <TextField
            icon="call-outline"
            label="Telefon"
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
          />
          <TextField
            icon="mail-outline"
            label="E-posta"
            value={editEmail}
            onChangeText={setEditEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {profileError ? <Text style={styles.renewError}>{profileError}</Text> : null}
          {profileSuccess ? <Text style={styles.successText}>{profileSuccess}</Text> : null}
          <Button
            label="Bilgileri Kaydet"
            onPress={handleSaveProfile}
            loading={profileSaving}
            variant="secondary"
            icon="save-outline"
          />
        </View>
      </Card>

      <Card>
        <View style={styles.balanceHeader}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.gold} />
          <Text style={styles.sectionTitle}>Parola Değiştir</Text>
        </View>
        <View style={styles.formGap}>
          <TextField
            icon="key-outline"
            label="Mevcut Parola"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureToggle
            autoCapitalize="none"
          />
          <TextField
            icon="lock-closed-outline"
            label="Yeni Parola"
            value={newPassword}
            onChangeText={setNewPassword}
            secureToggle
            autoCapitalize="none"
          />
          <TextField
            icon="lock-closed-outline"
            label="Yeni Parola (Tekrar)"
            value={newPasswordConfirmation}
            onChangeText={setNewPasswordConfirmation}
            secureToggle
            autoCapitalize="none"
          />
          {passwordError ? <Text style={styles.renewError}>{passwordError}</Text> : null}
          {passwordSuccess ? <Text style={styles.successText}>{passwordSuccess}</Text> : null}
          <Button
            label="Parolayı Değiştir"
            onPress={handleChangePassword}
            loading={passwordSaving}
            variant="secondary"
            icon="checkmark-circle-outline"
            disabled={!currentPassword || !newPassword || !newPasswordConfirmation}
          />
        </View>
      </Card>

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
  successText: { ...typography.caption, color: colors.success, textAlign: 'center' },
  formGap: { gap: spacing.sm },
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
