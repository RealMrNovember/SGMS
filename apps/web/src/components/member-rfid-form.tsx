'use client';

import { updateMemberRfid, type UpdateMemberRfidState } from '@/actions/members';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: UpdateMemberRfidState = {};

export function MemberRfidForm({
  memberId,
  currentRfid,
  canManage,
}: {
  memberId: string;
  currentRfid: string | null;
  canManage: boolean;
}) {
  const t = useTranslations('checkIn.rfid');
  const [state, formAction, pending] = useActionState(updateMemberRfid, initialState);

  if (!canManage) {
    return currentRfid ? (
      <p className="muted text-sm">
        {t('label')}: <span className="text-white">{currentRfid}</span>
      </p>
    ) : null;
  }

  return (
    <form action={formAction} className="mt-4 space-y-2 border-t border-white/5 pt-4">
      <input type="hidden" name="memberId" value={memberId} />
      <label className="muted text-xs">{t('label')}</label>
      <div className="flex gap-2">
        <input
          name="rfidTag"
          className="input flex-1"
          defaultValue={currentRfid ?? ''}
          placeholder={t('placeholder')}
        />
        <button type="submit" className="button px-3 py-2 text-xs" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </button>
      </div>
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-400">{state.success}</p> : null}
      <p className="muted text-xs">{t('hint')}</p>
    </form>
  );
}
