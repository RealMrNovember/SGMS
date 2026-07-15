'use client';

import { createPartner, type AdminPartnerActionState } from '@/actions/admin-partners';
import { useActionState } from 'react';

const initialState: AdminPartnerActionState = {};

export function CreatePartnerForm() {
  const [state, formAction, pending] = useActionState(createPartner, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h3 className="font-semibold">Yeni Temsilci Ekle</h3>
      <p className="muted text-xs leading-5">
        Örn. Enes ÖZKARCI gibi referans/satış temsilcileri buradan eklenir. Oluşturulunca kendisine
        özel bir giriş bilgisi üretilir — bu bilgi yalnızca bir kez gösterilir, kopyalayıp temsilciye
        iletin.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="name" className="muted text-xs">
            Ad Soyad
          </label>
          <input id="name" name="name" required className="input" placeholder="Enes ÖZKARCI" />
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="muted text-xs">
            E-posta (giriş için)
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div className="space-y-1">
          <label htmlFor="commissionRate" className="muted text-xs">
            Komisyon oranı (%)
          </label>
          <input
            id="commissionRate"
            name="commissionRate"
            type="number"
            min={0}
            max={100}
            step="0.5"
            defaultValue={10}
            className="input"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="notes" className="muted text-xs">
            Not (opsiyonel)
          </label>
          <input id="notes" name="notes" className="input" maxLength={500} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <p className="text-emerald-200">{state.success}</p>
          {state.generatedPassword ? (
            <p className="mt-2 font-mono text-xs text-emerald-100">
              Geçici parola: {state.generatedPassword}
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="button button-gold px-5 py-2.5 text-sm">
        {pending ? 'Oluşturuluyor…' : 'Temsilci Oluştur'}
      </button>
    </form>
  );
}
