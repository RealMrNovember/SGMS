'use client';

import {
  grantHierarchyMember,
  revokeHierarchyMember,
  setOrganizationParent,
  type AdminHierarchyActionState,
} from '@/actions/admin-hierarchy';
import { useActionState } from 'react';

type HierarchyMemberRow = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type Props = {
  organizationId: string;
  currentParentId: string | null;
  parentOptions: { id: string; name: string }[];
  childOrganizations: { id: string; name: string }[];
  hierarchyMembers: HierarchyMemberRow[];
};

const initialState: AdminHierarchyActionState = {};

export function OrganizationHierarchyPanel({
  organizationId,
  currentParentId,
  parentOptions,
  childOrganizations,
  hierarchyMembers,
}: Props) {
  const [parentState, parentAction, parentPending] = useActionState(setOrganizationParent, initialState);
  const [grantState, grantAction, grantPending] = useActionState(grantHierarchyMember, initialState);
  const [revokeState, revokeAction] = useActionState(revokeHierarchyMember, initialState);

  return (
    <div className="card space-y-6 p-5">
      <div>
        <h3 className="font-semibold">Kurumsal Hiyerarşi</h3>
        <p className="muted mt-1 text-xs leading-5">
          Bu organizasyonu bir üst düğüme (şirket/bölge) bağlayın ve alt ağacın konsolide,
          salt-okunur raporlarını görebilecek kullanıcıları atayın. Mevcut personel rollerini
          (OWNER/ADMIN/STAFF/TRAINER/VIEWER) etkilemez.
        </p>
      </div>

      <form action={parentAction} className="space-y-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="block space-y-1 text-sm">
          <span className="muted">Üst organizasyon (ebeveyn düğüm)</span>
          <select name="parentOrganizationId" defaultValue={currentParentId ?? ''} className="input w-full">
            <option value="">— Ebeveyn yok (kök düğüm) —</option>
            {parentOptions.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        {parentState.error ? <p className="text-xs text-rose-300">{parentState.error}</p> : null}
        {parentState.success ? <p className="text-xs text-emerald-300">{parentState.success}</p> : null}
        <button type="submit" disabled={parentPending} className="button px-4 py-2 text-sm">
          {parentPending ? 'Kaydediliyor…' : 'Ebeveyni Kaydet'}
        </button>
      </form>

      {childOrganizations.length > 0 ? (
        <div>
          <p className="muted text-xs uppercase tracking-wide">Doğrudan alt şubeler ({childOrganizations.length})</p>
          <ul className="mt-2 space-y-1 text-sm">
            {childOrganizations.map((child) => (
              <li key={child.id}>
                <a href={`/admin/organizations/${child.id}`} className="hover:underline">
                  {child.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-[var(--border)] pt-5">
        <p className="font-medium">Konsolide görünüm yetkisi ver</p>
        <p className="muted mt-1 text-xs leading-5">
          Bu düğüm ve altındaki tüm şubelerin toplu raporunu görebilecek bir kullanıcı ekleyin
          (örn. bölge müdürü). Kullanıcının sistemde kayıtlı bir hesabı olmalı.
        </p>
        <form action={grantAction} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="email" type="email" placeholder="kullanici@ornek.com" required className="input" />
          <select name="role" defaultValue="REGIONAL_MANAGER" className="input">
            <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
            <option value="REGIONAL_MANAGER">REGIONAL_MANAGER</option>
          </select>
          <button type="submit" disabled={grantPending} className="button button-gold px-4 py-2 text-sm">
            {grantPending ? 'Ekleniyor…' : 'Ata'}
          </button>
        </form>
        {grantState.error ? <p className="mt-2 text-xs text-rose-300">{grantState.error}</p> : null}
        {grantState.success ? <p className="mt-2 text-xs text-emerald-300">{grantState.success}</p> : null}
      </div>

      {hierarchyMembers.length > 0 ? (
        <div>
          <p className="muted text-xs uppercase tracking-wide">Mevcut atamalar ({hierarchyMembers.length})</p>
          <ul className="mt-2 space-y-2">
            {hierarchyMembers.map((hm) => (
              <li key={hm.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {hm.user.name} <span className="muted">({hm.user.email})</span> — {hm.role}
                </span>
                <form action={revokeAction}>
                  <input type="hidden" name="hierarchyMemberId" value={hm.id} />
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <button type="submit" className="button-outline-gold rounded-lg px-3 py-1 text-xs">
                    Kaldır
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {revokeState.error ? <p className="text-xs text-rose-300">{revokeState.error}</p> : null}
      {revokeState.success ? <p className="text-xs text-emerald-300">{revokeState.success}</p> : null}
    </div>
  );
}
