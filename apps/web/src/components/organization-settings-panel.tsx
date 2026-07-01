'use client';

import {
  updateOrganizationSettings,
  type OrganizationSettingsState,
} from '@/actions/organization-settings';
import type { OrganizationSettings } from '@/lib/admin/org-settings';
import { useActionState } from 'react';

const LOCALES = ['tr', 'en', 'ru', 'fr', 'es', 'az'] as const;

export function OrganizationSettingsPanel({
  settings,
}: {
  settings: OrganizationSettings;
}) {
  const [state, action, pending] = useActionState(updateOrganizationSettings, {} as OrganizationSettingsState);

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

      <form action={action} className="card space-y-5 p-5">
        <div>
          <h3 className="text-lg font-semibold">Salon ayarları</h3>
          <p className="muted mt-1 text-sm">
            Varsayılan dil yeni personel ve cookie seçimi olmayan kullanıcılar için geçerlidir.
            Opsiyonel özellikler salon bazında açılıp kapatılabilir.
          </p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="muted">Varsayılan dil</span>
          <select
            name="defaultLocale"
            defaultValue={settings.defaultLocale ?? 'tr'}
            className="input w-full max-w-xs"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="muted">Yazıyor göstergesi (opsiyonel)</span>
            <select
              name="typingIndicator"
              defaultValue={settings.features?.typingIndicator === false ? 'off' : 'on'}
              className="input w-full"
            >
              <option value="on">Açık</option>
              <option value="off">Kapalı</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">Mesaj şikayeti (opsiyonel)</span>
            <select
              name="messageReports"
              defaultValue={settings.features?.messageReports === false ? 'off' : 'on'}
              className="input w-full"
            >
              <option value="on">Açık</option>
              <option value="off">Kapalı</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">İmzalı avatar URL (R2 opsiyonel)</span>
            <select
              name="signedAvatarUrls"
              defaultValue={settings.features?.signedAvatarUrls ? 'on' : 'off'}
              className="input w-full"
            >
              <option value="off">Kapalı (public CDN)</option>
              <option value="on">Açık (signed URL)</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">Token revoke Redis önbelleği (opsiyonel)</span>
            <select
              name="tokenRevokeRedisCache"
              defaultValue={settings.features?.tokenRevokeRedisCache ? 'on' : 'off'}
              className="input w-full"
            >
              <option value="off">Kapalı</option>
              <option value="on">Açık</option>
            </select>
          </label>
        </div>

        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Ayarları kaydet'}
        </button>
      </form>
    </div>
  );
}
