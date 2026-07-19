'use client';

import {
  adminResetMemberPassword,
  adminResetTwoFactor,
  adminToggleMemberActive,
  adminUpdateMemberRole,
  adminUpdateStaffRfid,
  type AdminTeamState,
} from '@/actions/admin-team';
import { AdminBadge } from '@/components/admin/admin-badge';
import { formatDateTimeTr } from '@/lib/admin/format';
import { useActionState } from 'react';

type MemberRow = {
  id: string;
  role: string;
  isActive: boolean;
  rfidTag: string | null;
  user: {
    name: string | null;
    email: string;
    lastLoginAt: Date | null;
  };
  twoFactorEnabledAt: Date | null;
};

export function OrganizationTeamMemberRow({
  organizationId,
  member,
  onFeedback,
}: {
  organizationId: string;
  member: MemberRow;
  onFeedback: (state: AdminTeamState) => void;
}) {
  const wrap =
    (fn: typeof adminUpdateMemberRole) =>
    async (prev: AdminTeamState, formData: FormData) => {
      const result = await fn(prev, formData);
      onFeedback(result);
      return result;
    };

  const [, roleAction] = useActionState(wrap(adminUpdateMemberRole), {} as AdminTeamState);
  const [, rfidAction] = useActionState(wrap(adminUpdateStaffRfid), {} as AdminTeamState);
  const [, toggleAction] = useActionState(wrap(adminToggleMemberActive), {} as AdminTeamState);
  const [, resetAction, resetPending] = useActionState(wrap(adminResetMemberPassword), {} as AdminTeamState);
  const [, resetTwoFactorAction, resetTwoFactorPending] = useActionState(
    wrap(adminResetTwoFactor),
    {} as AdminTeamState,
  );

  return (
    <tr className="border-b border-[var(--border)] align-top last:border-none">
      <td className="px-4 py-4">
        <p className="font-medium">{member.user.name ?? '—'}</p>
        <a href={`mailto:${member.user.email}`} className="muted text-xs hover:underline">
          {member.user.email}
        </a>
      </td>
      <td className="px-4 py-4">
        <form action={roleAction} className="flex flex-col gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          <select name="role" defaultValue={member.role} className="input text-xs">
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="TRAINER">TRAINER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button type="submit" className="button px-3 py-2 text-xs min-h-[2.75rem]">
            Rol kaydet
          </button>
        </form>
      </td>
      <td className="px-4 py-4">
        <form action={rfidAction} className="flex flex-col gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          <input
            name="rfidTag"
            defaultValue={member.rfidTag ?? ''}
            placeholder="Kart UID"
            className="input text-xs"
          />
          <button type="submit" className="button px-3 py-2 text-xs min-h-[2.75rem]">
            RFID kaydet
          </button>
        </form>
      </td>
      <td className="px-4 py-4">
        <AdminBadge label={member.isActive ? 'Aktif' : 'Pasif'} tone={member.isActive ? 'success' : 'danger'} />
      </td>
      <td className="px-4 py-4 muted text-xs">{formatDateTimeTr(member.user.lastLoginAt)}</td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2">
          <form action={toggleAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <input type="hidden" name="isActive" value={member.isActive ? 'false' : 'true'} />
            <button type="submit" className="button px-3 py-2 text-xs min-h-[2.75rem]">
              {member.isActive ? 'Devre dışı bırak' : 'Aktifleştir'}
            </button>
          </form>
          <form action={resetAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <button type="submit" className="button px-3 py-2 text-xs min-h-[2.75rem]" disabled={resetPending}>
              Parola sıfırla
            </button>
          </form>
          {member.twoFactorEnabledAt ? (
            <form action={resetTwoFactorAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="membershipId" value={member.id} />
              <button
                type="submit"
                className="button px-3 py-2 text-xs min-h-[2.75rem]"
                disabled={resetTwoFactorPending}
              >
                2FA sıfırla
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
