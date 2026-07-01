'use client';

import { updateOrganizationProfile, type AdminActionState } from '@/actions/admin-organizations';
import { useActionState } from 'react';

type Props = {
  organization: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string;
    timezone: string;
  };
};

export function OrganizationProfileForm({ organization }: Props) {
  const [state, action, pending] = useActionState(updateOrganizationProfile, {} as AdminActionState);

  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h4 className="font-medium">Salon profili</h4>
        <p className="muted mt-1 text-sm">İletişim ve operasyon bilgilerini Master Admin olarak düzenleyin.</p>
      </div>

      <input type="hidden" name="organizationId" value={organization.id} />

      {state.error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="muted">Salon adı</span>
          <input name="name" defaultValue={organization.name} className="input w-full" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">E-posta</span>
          <input name="email" type="email" defaultValue={organization.email ?? ''} className="input w-full" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Telefon</span>
          <input name="phone" defaultValue={organization.phone ?? ''} className="input w-full" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Şehir</span>
          <input name="city" defaultValue={organization.city ?? ''} className="input w-full" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="muted">Adres</span>
          <input name="address" defaultValue={organization.address ?? ''} className="input w-full" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Ülke</span>
          <input name="country" defaultValue={organization.country} className="input w-full" maxLength={2} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Saat dilimi</span>
          <input name="timezone" defaultValue={organization.timezone} className="input w-full" />
        </label>
      </div>

      <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
        Profili kaydet
      </button>
    </form>
  );
}
