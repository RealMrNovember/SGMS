'use client';

import { createAthletePortalAccess, type PortalAccessState } from '@/actions/athlete-portal';
import { useActionState } from 'react';

const initial: PortalAccessState = {};

export function AthletePortalAccessForm({
  gymMemberId,
  defaultEmail,
  hasPortalAccess,
}: {
  gymMemberId: string;
  defaultEmail: string;
  hasPortalAccess: boolean;
}) {
  const [state, action, pending] = useActionState(createAthletePortalAccess, initial);

  if (hasPortalAccess) {
    return (
      <section className="card space-y-2 p-6">
        <h3 className="text-lg font-semibold">Portal / Mobil erişim</h3>
        <p className="muted text-sm">Bu üyenin zaten sporcu portalı ve mobil giriş hesabı var.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">Portal / Mobil erişim oluştur</h3>
      <p className="muted text-sm">
        Sporcuya e-posta + geçici parola ile mobil uygulama / sporcu web portalı girişi açılır.
      </p>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? (
        <div className="space-y-1 text-sm text-emerald-300">
          <p>{state.success}</p>
          {state.temporaryPassword ? (
            <p className="font-mono text-amber-200">
              Geçici parola: <strong>{state.temporaryPassword}</strong> — sporcuya iletin (bir kez
              gösterilir).
            </p>
          ) : null}
        </div>
      ) : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="gymMemberId" value={gymMemberId} />
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">Giriş e-postası</label>
          <input
            type="email"
            name="email"
            className="input"
            required
            defaultValue={defaultEmail}
          />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          Erişim oluştur
        </button>
      </form>
    </section>
  );
}
