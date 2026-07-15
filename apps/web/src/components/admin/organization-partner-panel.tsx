'use client';

import { assignPartnerToOrganization, type AdminPartnerActionState } from '@/actions/admin-partners';
import { useActionState } from 'react';

type Props = {
  organizationId: string;
  currentPartnerId: string | null;
  partners: { id: string; name: string; code: string }[];
};

const initialState: AdminPartnerActionState = {};

export function OrganizationPartnerPanel({ organizationId, currentPartnerId, partners }: Props) {
  const [state, formAction, pending] = useActionState(assignPartnerToOrganization, initialState);

  return (
    <form action={formAction} className="card space-y-3 p-5">
      <h3 className="font-semibold">Temsilci (Partner) Ataması</h3>
      <p className="muted text-xs leading-5">
        Bu organizasyonu getiren temsilciyi seçin — atanan temsilci, kendi panelinden bu müşterinin
        deneme süresini, özel indirimini ve ek kapasitesini sınırlı yetkiyle yönetebilir.
      </p>
      <input type="hidden" name="organizationId" value={organizationId} />
      <select name="partnerId" defaultValue={currentPartnerId ?? ''} className="input">
        <option value="">— Temsilci atanmadı —</option>
        {partners.map((partner) => (
          <option key={partner.id} value={partner.id}>
            {partner.name} ({partner.code})
          </option>
        ))}
      </select>
      {state.error ? <p className="text-xs text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-300">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="button px-4 py-2 text-sm">
        {pending ? 'Kaydediliyor…' : 'Atamayı Kaydet'}
      </button>
    </form>
  );
}
