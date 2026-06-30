'use client';

import { approveBillingRequest, rejectBillingRequest } from '@/actions/admin-billing';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function BillingRequestActions({
  organizationId,
  requestId,
}: {
  organizationId: string;
  requestId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="button button-gold px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() => run(() => approveBillingRequest(organizationId, requestId))}
      >
        Ödemeyi onayla
      </button>
      <button
        type="button"
        className="button px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() => run(() => rejectBillingRequest(organizationId, requestId))}
      >
        Reddet
      </button>
    </div>
  );
}
