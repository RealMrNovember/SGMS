import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PressableScale } from '../components/ui/PressableScale';
import { fetchStoreOrders, fetchStoreProducts, startStoreCheckout } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { AthleteSession, StoreOrder, StoreProduct } from '../lib/types';

type StoreView = 'products' | 'orders';

/**
 * Faz 40 — sporcu self-servis mağazası. Personelin `/dashboard/pos`'ta
 * "Mobil mağazada göster" işaretlediği `ExpenseCategory`'ler ürün olarak
 * listelenir; ödeme Faz 8.7.1'deki üyelik yenileme akışıyla birebir aynı
 * Iyzico/PayTR hosted checkout'u kullanır (`/api/v1/store/checkout` →
 * dönen `checkoutUrl` sistem tarayıcısında açılır).
 */
export function StoreScreen({ session, onBack }: { session: AthleteSession; onBack: () => void }) {
  const [view, setView] = useState<StoreView>('products');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchStoreProducts(session.accessToken);
      setProducts(data.products);
    } catch {
      setError('Ürünler yüklenemedi.');
    }
  }, [session.accessToken]);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchStoreOrders(session.accessToken);
      setOrders(data.orders);
    } catch {
      setError('Siparişler yüklenemedi.');
    }
  }, [session.accessToken]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = view === 'products' ? loadProducts : loadOrders;
    void load().finally(() => setLoading(false));
  }, [view, loadProducts, loadOrders]);

  async function handleRefresh() {
    setRefreshing(true);
    await (view === 'products' ? loadProducts() : loadOrders());
    setRefreshing(false);
  }

  function changeQuantity(categoryId: string, delta: number, max: number | null) {
    setCart((prev) => {
      const next = (prev[categoryId] ?? 0) + delta;
      if (next <= 0) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      if (max != null && next > max) {
        return prev;
      }
      return { ...prev, [categoryId]: next };
    });
  }

  const cartLines = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartCount = cartLines.reduce((sum, [, qty]) => sum + qty, 0);
  const cartTotal = cartLines.reduce((sum, [categoryId, qty]) => {
    const product = products.find((p) => p.id === categoryId);
    return sum + (product ? Number(product.price) * qty : 0);
  }, 0);

  async function handleCheckout() {
    if (cartLines.length === 0) return;
    setCheckingOut(true);
    setError(null);
    try {
      const result = await startStoreCheckout(
        session.accessToken,
        cartLines.map(([categoryId, quantity]) => ({ categoryId, quantity })),
      );
      await Linking.openURL(result.checkoutUrl);
      setCart({});
    } catch (e) {
      Alert.alert('Sipariş başlatılamadı', e instanceof Error ? e.message : 'Lütfen tekrar deneyin.');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
      >
        <View style={styles.headerRow}>
          <Button label="Geri" variant="ghost" icon="arrow-back-outline" onPress={onBack} />
          <Text style={styles.title}>Mağaza</Text>
        </View>

        <View style={styles.tabRow}>
          <ViewTab label="Ürünler" active={view === 'products'} onPress={() => setView('products')} />
          <ViewTab label="Siparişlerim" active={view === 'orders'} onPress={() => setView('orders')} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
        ) : view === 'products' ? (
          products.length === 0 ? (
            <Text style={styles.hint}>Salonunuz henüz mağaza ürünü eklemedi.</Text>
          ) : (
            products.map((product) => (
              <Card key={product.id}>
                <View style={styles.productRow}>
                  <View style={styles.productImageWrap}>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                    ) : (
                      <Ionicons name="bag-outline" size={22} color={colors.faint} />
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                    {product.stockQuantity != null && product.stockQuantity <= 5 ? (
                      <Badge label={`Stok: ${product.stockQuantity}`} tone="danger" />
                    ) : null}
                  </View>
                  <View style={styles.stepper}>
                    <PressableScale
                      onPress={() => changeQuantity(product.id, -1, product.stockQuantity)}
                      style={styles.stepperButton}
                    >
                      <Ionicons name="remove" size={16} color={colors.gold} />
                    </PressableScale>
                    <Text style={styles.stepperValue}>{cart[product.id] ?? 0}</Text>
                    <PressableScale
                      onPress={() => changeQuantity(product.id, 1, product.stockQuantity)}
                      style={styles.stepperButton}
                    >
                      <Ionicons name="add" size={16} color={colors.gold} />
                    </PressableScale>
                  </View>
                </View>
              </Card>
            ))
          )
        ) : orders.length === 0 ? (
          <Text style={styles.hint}>Henüz mağaza siparişiniz yok.</Text>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <View style={styles.orderRow}>
                <View style={styles.productImageWrap}>
                  {order.imageUrl ? (
                    <Image source={{ uri: order.imageUrl }} style={styles.productImage} />
                  ) : (
                    <Ionicons name="bag-outline" size={22} color={colors.faint} />
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{order.productName}</Text>
                  <Text style={styles.productPrice}>{formatPrice(order.amount)}</Text>
                  <Text style={styles.hint}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                </View>
                <Badge
                  label={order.status !== 'PAID' ? 'Ödeme bekliyor' : order.delivered ? 'Teslim edildi' : 'Hazırlanıyor'}
                  tone={order.status !== 'PAID' ? 'danger' : order.delivered ? 'success' : 'gold'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {view === 'products' && cartCount > 0 ? (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>{cartCount} ürün</Text>
            <Text style={styles.cartTotal}>{formatPrice(cartTotal)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Button label="Sepeti Öde" onPress={handleCheckout} loading={checkingOut} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ViewTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.viewTab, active && styles.viewTabActive]}>
      <Text style={[styles.viewTabLabel, active && styles.viewTabLabelActive]}>{label}</Text>
    </PressableScale>
  );
}

function formatPrice(value: string | number) {
  return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  viewTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewTabActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  viewTabLabel: { ...typography.caption, color: colors.muted },
  viewTabLabelActive: { color: colors.gold },
  hint: { ...typography.caption, color: colors.faint },
  error: { color: '#fca5a5', ...typography.caption },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  productImageWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: { width: '100%', height: '100%' },
  productInfo: { flex: 1, gap: 2 },
  productName: { ...typography.subheading, color: colors.text },
  productPrice: { ...typography.body, color: colors.gold },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { ...typography.subheading, color: colors.text, minWidth: 20, textAlign: 'center' },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  cartCount: { ...typography.caption, color: colors.muted },
  cartTotal: { ...typography.heading, color: colors.text },
});
