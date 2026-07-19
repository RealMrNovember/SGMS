'use client';

import { hardDeleteOrganization, type AdminActionState } from '@/actions/admin-organizations';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: AdminActionState = {};

export function OrganizationHardDeleteButton({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(hardDeleteOrganization, initialState);
  const [expanded, setExpanded] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => router.push('/admin/organizations'), 1200);
      return () => clearTimeout(timeout);
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        {state.success}
      </p>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="button border border-rose-500/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
        onClick={() => setExpanded(true)}
      >
        Kalıcı Olarak Sil
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="text-sm font-medium text-rose-200">
        Bu işlem geri alınamaz. Tüm üyeler, personel, işlemler ve mesajlar kalıcı olarak silinecek.
      </p>
      <p className="muted text-xs">
        Devam etmek için organizasyon adını tam olarak yazın: <strong>{organizationName}</strong>
      </p>
      <input
        type="text"
        name="confirmName"
        className="input"
        value={confirmName}
        onChange={(event) => setConfirmName(event.target.value)}
        autoComplete="off"
      />
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="button bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-500"
          disabled={pending || confirmName !== organizationName}
        >
          {pending ? 'Siliniyor…' : 'Kalıcı Olarak Sil — Onayla'}
        </button>
        <button
          type="button"
          className="muted text-sm hover:text-white"
          onClick={() => {
            setExpanded(false);
            setConfirmName('');
          }}
          disabled={pending}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
