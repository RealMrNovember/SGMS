'use client';

import { reportMessage, type MessageReportState } from '@/actions/message-reports';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const initialState: MessageReportState = {};

export function MessageReportButton({ messageId }: { messageId: string }) {
  const t = useTranslations('messages.report');
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportMessage, initialState);

  if (state.success) {
    return (
      <p className="muted mt-1 text-[10px] text-emerald-400/90">{state.success}</p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="muted mt-1 text-[10px] underline-offset-2 hover:text-white hover:underline"
      >
        {t('action')}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-black/20 p-2">
      <input type="hidden" name="messageId" value={messageId} />
      <label className="block text-[10px] font-medium text-white/80">{t('reasonLabel')}</label>
      <textarea
        name="reason"
        required
        minLength={3}
        maxLength={2000}
        rows={2}
        placeholder={t('reasonPlaceholder')}
        className="w-full resize-none rounded-md border border-[var(--border)] bg-white/[0.04] px-2 py-1.5 text-xs text-white"
      />
      {state.error ? <p className="text-[10px] text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-500/20 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="muted rounded-md px-2 py-1 text-[10px] hover:text-white"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
