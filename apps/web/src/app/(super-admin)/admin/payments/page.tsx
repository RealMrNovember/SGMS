import { fetchPlatformPaymentSettings } from '@/actions/platform-payment-settings';
import { PlatformPaymentSettingsPanel } from '@/components/platform-payment-settings-panel';

export default async function AdminPaymentsPage() {
  const settings = await fetchPlatformPaymentSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Ödeme Ayarları</h2>
        <p className="muted mt-2 text-sm">
          SGMS&apos;in gym sahiplerinden abonelik tahsilatı için kullandığı ödeme sağlayıcısı burada
          yapılandırılır. Anahtarlar kaydedildikten sonra yalnızca son 4 hanesi gösterilir.
        </p>
      </section>

      <PlatformPaymentSettingsPanel settings={settings} />
    </div>
  );
}
