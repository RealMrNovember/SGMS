'use client';

import { removeStaffMember, type RemoveStaffMemberState } from '@/actions/team';
import { useActionState, useState } from 'react';

const initialState: RemoveStaffMemberState = {};

export function RemoveStaffButton({ membershipId, name }: { membershipId: string; name: string }) {
  const [state, formAction, pending] = useActionState(removeStaffMember, initialState);
  const [confirming, setConfirming] = useState(false);

  if (state.success) {
    return <span className="muted text-xs">Çıkarıldı</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="text-xs text-rose-400 hover:text-rose-300"
        onClick={() => setConfirming(true)}
      >
        Çıkar
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <span className="muted text-xs">{name} çıkarılsın mı?</span>
      <button type="submit" className="text-xs font-medium text-rose-400 hover:text-rose-300" disabled={pending}>
        {pending ? 'Çıkarılıyor…' : 'Onayla'}
      </button>
      <button
        type="button"
        className="muted text-xs hover:text-white"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Vazgeç
      </button>
      {state.error ? <span className="text-xs text-rose-400">{state.error}</span> : null}
    </form>
  );
}
