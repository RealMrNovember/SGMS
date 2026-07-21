'use client';

import { cancelPtSession, completePtSession, type TrainerActionState } from '@/actions/trainers';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const initialState: TrainerActionState = {};

export function PtSessionActions({ sessionId }: { sessionId: string }) {
  const t = useTranslations('trainers.sessionActions');
  const [showComplete, setShowComplete] = useState(false);
  const [completeState, completeAction, completePending] = useActionState(completePtSession, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelPtSession, initialState);

  if (showComplete) {
    return (
      <form action={completeAction} className="flex items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input
          type="number"
          name="revenueAmount"
          min={0}
          step="0.01"
          required
          placeholder={t('amountPlaceholder')}
          className="input w-28 py-1.5 text-xs"
          autoFocus
        />
        <button type="submit" disabled={completePending} className="button button-gold px-3 py-1.5 text-xs">
          {completePending ? t('saving') : t('confirm')}
        </button>
        <button
          type="button"
          onClick={() => setShowComplete(false)}
          className="button px-3 py-1.5 text-xs"
        >
          {t('cancel')}
        </button>
        {completeState.error ? <p className="text-xs text-rose-300">{completeState.error}</p> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setShowComplete(true)}
        className="button button-gold px-3 py-1.5 text-xs"
      >
        {t('complete')}
      </button>
      <form action={cancelAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="reason" value="NO_SHOW" />
        <button type="submit" disabled={cancelPending} className="button px-3 py-1.5 text-xs">
          {t('noShow')}
        </button>
      </form>
      <form action={cancelAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="reason" value="CANCELED_BY_MEMBER" />
        <button type="submit" disabled={cancelPending} className="button px-3 py-1.5 text-xs">
          {t('cancelByMember')}
        </button>
      </form>
      <form action={cancelAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="reason" value="CANCELED_BY_TRAINER" />
        <button type="submit" disabled={cancelPending} className="button px-3 py-1.5 text-xs">
          {t('cancelByTrainer')}
        </button>
      </form>
      {cancelState.error ? <p className="text-xs text-rose-300">{cancelState.error}</p> : null}
    </div>
  );
}
