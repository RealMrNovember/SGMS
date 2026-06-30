'use client';

import { updateStaffRfid, type UpdateStaffRfidState } from '@/actions/team';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: UpdateStaffRfidState = {};

export function StaffRfidField({
  membershipId,
  currentRfid,
  canManage,
}: {
  membershipId: string;
  currentRfid: string | null;
  canManage: boolean;
}) {
  const t = useTranslations('checkIn.rfid');
  const [state, formAction, pending] = useActionState(updateStaffRfid, initialState);

  if (!canManage) {
    return <span className="muted text-xs">{currentRfid ?? '—'}</span>;
  }

  return (
    <form action={formAction} className="flex min-w-[10rem] flex-col gap-1">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="flex gap-1">
        <input
          name="rfidTag"
          className="input py-1 text-xs"
          defaultValue={currentRfid ?? ''}
          placeholder={t('placeholder')}
        />
        <button type="submit" className="button px-2 py-1 text-[10px]" disabled={pending}>
          {pending ? '…' : t('save')}
        </button>
      </div>
      {state.error ? <span className="text-[10px] text-rose-400">{state.error}</span> : null}
      {state.success ? <span className="text-[10px] text-emerald-400">{state.success}</span> : null}
    </form>
  );
}
