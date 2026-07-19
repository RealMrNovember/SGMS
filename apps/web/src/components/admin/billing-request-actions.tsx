'use client';

import {
  approveBillingRequest,
  rejectBillingRequest,
  resendProformaEmail,
} from '@/actions/admin-billing';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function BillingRequestActions({
  organizationId,
  requestId,
  status,
  emailStatus,
}: {
  organizationId: string;
  requestId: string;
  status: string;
  emailStatus?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (status === 'pending') {
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

  if (status === 'approved') {
    return (
      <div className="flex flex-col items-end gap-1">
        {emailStatus ? (
          <span className="muted text-[11px]">
            Proforma e-posta: {emailStatus}
          </span>
        ) : null}
        <button
          type="button"
          className="button px-3 py-1.5 text-xs"
          disabled={pending}
          onClick={() => run(() => resendProformaEmail(organizationId, requestId))}
        >
          Proforma e-postasını yeniden gönder
        </button>
      </div>
    );
  }

  return null;
}
