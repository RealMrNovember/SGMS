'use client';

import {
  activateOrganization,
  archiveOrganization,
  suspendOrganization,
  syncOrganizationLicenseAdmin,
  type AdminActionState,
} from '@/actions/admin-organizations';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function OrganizationQuickActions({
  organizationId,
  status,
}: {
  organizationId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<AdminActionState>({});

  function run(action: () => Promise<AdminActionState>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {message.error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {message.error}
        </p>
      ) : null}
      {message.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message.success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status !== 'SUSPENDED' ? (
          <button
            type="button"
            className="button px-4 py-2 text-sm"
            disabled={pending}
            onClick={() => run(() => suspendOrganization(organizationId))}
          >
            Askıya al
          </button>
        ) : (
          <button
            type="button"
            className="button button-gold px-4 py-2 text-sm"
            disabled={pending}
            onClick={() => run(() => activateOrganization(organizationId))}
          >
            Yeniden aç
          </button>
        )}
        <button
          type="button"
          className="button px-4 py-2 text-sm"
          disabled={pending}
          onClick={() => run(() => syncOrganizationLicenseAdmin(organizationId))}
        >
          Cloud senkronu
        </button>
        {status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="button px-4 py-2 text-sm"
            disabled={pending}
            onClick={() => run(() => archiveOrganization(organizationId))}
          >
            Arşivle
          </button>
        ) : null}
        <a
          href="https://cloud.cicibyte.com/licenses"
          target="_blank"
          rel="noreferrer"
          className="button px-4 py-2 text-sm"
        >
          CiciByte Cloud ↗
        </a>
      </div>
    </div>
  );
}
