'use client';

import { sendDirectMessage, sendTypingPulse, type SendMessageState } from '@/actions/messages';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef } from 'react';

const initialState: SendMessageState = {};

export function MessageCompose({
  receiverId,
  receiverLabel,
  compact = false,
}: {
  receiverId: string;
  receiverLabel?: string;
  compact?: boolean;
}) {
  const t = useTranslations('messages.compose');
  const [state, formAction, pending] = useActionState(sendDirectMessage, initialState);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  function handleTyping() {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void sendTypingPulse(receiverId);
    }, 350);
  }

  return (
    <div className={compact ? 'border-t border-[var(--border)] p-4' : 'space-y-4'}>
      {state.error ? (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="receiverId" value={receiverId} />
        <div className="min-w-0 flex-1 space-y-1">
          {receiverLabel && !compact ? (
            <p className="muted text-xs">
              {t('to')}: <span className="text-white">{receiverLabel}</span>
            </p>
          ) : null}
          <textarea
            id={`content-${receiverId}`}
            name="content"
            rows={compact ? 2 : 4}
            className="input min-h-[44px] resize-y text-sm"
            placeholder={t('placeholder')}
            required
            onInput={handleTyping}
          />
        </div>
        <button
          type="submit"
          className="button shrink-0 px-5 py-2.5 text-sm"
          disabled={pending}
        >
          {pending ? t('sending') : t('submit')}
        </button>
      </form>
    </div>
  );
}
