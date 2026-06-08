'use client';

import { markMessageRead } from '@/actions/messages';
import { useTransition } from 'react';

export function MarkReadButton({ messageId }: { messageId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button px-3 py-1.5 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await markMessageRead(messageId);
        });
      }}
    >
      {pending ? '…' : 'Okundu'}
    </button>
  );
}
