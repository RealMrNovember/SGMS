'use client';

import { adminInviteTeamMember, type AdminTeamState } from '@/actions/admin-team';
import { OrganizationTeamMemberRow } from '@/components/admin/organization-team-member-row';
import { useActionState, useState } from 'react';

type MemberRow = {
  id: string;
  role: string;
  isActive: boolean;
  rfidTag: string | null;
  joinedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    lastLoginAt: Date | null;
  };
  twoFactorEnabledAt: Date | null;
};

export function OrganizationTeamPanel({
  organizationId,
  members,
}: {
  organizationId: string;
  members: MemberRow[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(adminInviteTeamMember, {} as AdminTeamState);
  const [feedback, setFeedback] = useState<AdminTeamState>({});

  const banner = inviteState.error || inviteState.success ? inviteState : feedback;

  return (
    <div className="space-y-6">
      {banner.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {banner.error}
        </p>
      ) : null}
      {banner.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {banner.success}
          {banner.temporaryPassword ? (
            <span className="mt-2 block font-mono text-[#c9a962]">Geçici parola: {banner.temporaryPassword}</span>
          ) : null}
        </p>
      ) : null}

      <form action={inviteAction} className="card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-5">
          <h4 className="font-medium">Personel davet et</h4>
          <p className="muted mt-1 text-sm">Resepsiyon, antrenör veya görüntüleyici ekleyin; yeni kullanıcıya geçici parola üretilir.</p>
        </div>
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="space-y-1 text-sm xl:col-span-2">
          <span className="muted">Ad soyad</span>
          <input name="name" className="input w-full" required />
        </label>
        <label className="space-y-1 text-sm xl:col-span-2">
          <span className="muted">E-posta</span>
          <input name="email" type="email" className="input w-full" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Rol</span>
          <select name="role" className="input w-full" defaultValue="STAFF">
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="TRAINER">TRAINER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
        <div className="xl:col-span-5">
          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={invitePending}>
            Personel ekle
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h4 className="font-medium">Ekip yönetimi ({members.length})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">RFID</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <OrganizationTeamMemberRow
                  key={member.id}
                  organizationId={organizationId}
                  member={member}
                  onFeedback={setFeedback}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
