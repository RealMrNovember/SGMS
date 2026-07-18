'use client';

import {
  updatePlatformPaymentSettings,
  type PlatformPaymentSettingsState,
} from '@/actions/platform-payment-settings';
import { useActionState, useState } from 'react';

type MaskedSettings = {
  activeGateway: 'NONE' | 'IYZICO' | 'PAYTR';
  iyzicoApiKeyMasked: string | null;
  iyzicoSecretKeyMasked: string | null;
  iyzicoBaseUrl: string;
  iyzicoSandbox: boolean;
  iyzicoConfigured: boolean;
  paytrMerchantIdMasked: string | null;
  paytrMerchantKeyMasked: string | null;
  paytrMerchantSaltMasked: string | null;
  paytrSandbox: boolean;
  paytrConfigured: boolean;
  bankTransferEnabled: boolean;
  ibanHolderName: string | null;
  ibanNumber: string | null;
  ibanBankName: string | null;
  bankTransferNote: string | null;
};

export function PlatformPaymentSettingsPanel({ settings }: { settings: MaskedSettings }) {
  const [state, action, pending] = useActionState(
    updatePlatformPaymentSettings,
    {} as PlatformPaymentSettingsState,
  );
  const [gateway, setGateway] = useState(settings.activeGateway);

  return (
    <div className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={action} className="card space-y-6 p-5">
        <div>
          <h3 className="text-lg font-semibold">Aktif ödeme sağlayıcısı</h3>
          <p className="muted mt-1 text-sm">
            Aboneliklerinizi (gym sahiplerinden tahsilat) kartla tahsil etmek için tek bir sağlayıcı
            seçin. Banka havalesi/EFT bundan bağımsız olarak her zaman ek seçenek olarak sunulabilir.
          </p>
          <select
            name="activeGateway"
            value={gateway}
            onChange={(event) => setGateway(event.target.value as typeof gateway)}
            className="input mt-3 w-full max-w-xs"
          >
            <option value="NONE">Henüz seçilmedi</option>
            <option value="IYZICO">iyzico</option>
            <option value="PAYTR">PayTR</option>
          </select>
          {gateway !== 'NONE' && !(gateway === 'IYZICO' ? settings.iyzicoConfigured : settings.paytrConfigured) ? (
            <p className="mt-2 text-xs text-amber-400">
              Bu sağlayıcı seçili ama anahtarlar henüz girilmedi — kartla ödeme aktif olana kadar
              müşterileriniz bu yöntemi göremeyecek.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold">iyzico</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">API Key {settings.iyzicoApiKeyMasked ? `(mevcut: ${settings.iyzicoApiKeyMasked})` : ''}</span>
              <input name="iyzicoApiKey" type="password" className="input w-full" placeholder="Değiştirmek için yeni değeri girin" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">Secret Key {settings.iyzicoSecretKeyMasked ? `(mevcut: ${settings.iyzicoSecretKeyMasked})` : ''}</span>
              <input name="iyzicoSecretKey" type="password" className="input w-full" placeholder="Değiştirmek için yeni değeri girin" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">API adresi</span>
              <select name="iyzicoBaseUrl" defaultValue={settings.iyzicoBaseUrl} className="input w-full">
                <option value="https://sandbox-api.iyzipay.com">Sandbox (test)</option>
                <option value="https://api.iyzipay.com">Canlı (production)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="iyzicoSandbox" value="on" defaultChecked={settings.iyzicoSandbox} />
              <span className="muted">Sandbox modu (test — gerçek para çekilmez)</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold">PayTR</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">Mağaza No {settings.paytrMerchantIdMasked ? `(mevcut: ${settings.paytrMerchantIdMasked})` : ''}</span>
              <input name="paytrMerchantId" type="password" className="input w-full" placeholder="Değiştirmek için yeni değeri girin" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">Mağaza Anahtarı {settings.paytrMerchantKeyMasked ? `(mevcut: ${settings.paytrMerchantKeyMasked})` : ''}</span>
              <input name="paytrMerchantKey" type="password" className="input w-full" placeholder="Değiştirmek için yeni değeri girin" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">Mağaza Salt {settings.paytrMerchantSaltMasked ? `(mevcut: ${settings.paytrMerchantSaltMasked})` : ''}</span>
              <input name="paytrMerchantSalt" type="password" className="input w-full" placeholder="Değiştirmek için yeni değeri girin" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="paytrSandbox" value="on" defaultChecked={settings.paytrSandbox} />
              <span className="muted">Test modu (gerçek para çekilmez)</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bankTransferEnabled"
              name="bankTransferEnabled"
              value="on"
              defaultChecked={settings.bankTransferEnabled}
            />
            <label htmlFor="bankTransferEnabled" className="font-semibold">
              Banka Havalesi / EFT&apos;yi ödeme seçeneği olarak göster
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="muted">Hesap sahibi</span>
              <input name="ibanHolderName" defaultValue={settings.ibanHolderName ?? ''} className="input w-full" placeholder="CiCiByte Yazılım A.Ş." />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">IBAN</span>
              <input name="ibanNumber" defaultValue={settings.ibanNumber ?? ''} className="input w-full" placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="muted">Banka adı</span>
              <input name="ibanBankName" defaultValue={settings.ibanBankName ?? ''} className="input w-full" placeholder="Örn. İş Bankası" />
            </label>
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="muted">Not (fatura/ekstrada görünecek)</span>
              <textarea
                name="bankTransferNote"
                defaultValue={settings.bankTransferNote ?? ''}
                className="input w-full"
                rows={2}
                placeholder="Açıklama kısmına organizasyon adınızı yazmayı unutmayın."
              />
            </label>
          </div>
        </div>

        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Ayarları kaydet'}
        </button>
      </form>
    </div>
  );
}
