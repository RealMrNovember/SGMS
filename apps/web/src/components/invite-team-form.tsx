'use client';

import { inviteTeamMember, type InviteTeamMemberState } from '@/actions/team';
import { useActionState } from 'react';

const initialState: InviteTeamMemberState = {};

const roleOptions = [
  { value: 'STAFF', label: 'Personel (STAFF)' },
  { value: 'TRAINER', label: 'Antrenör (TRAINER)' },
  { value: 'VIEWER', label: 'Görüntüleyici (VIEWER)' },
] as const;

export function InviteTeamForm({ canInvite }: { canInvite: boolean }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);

  if (!canInvite) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">
          Personel eklemek için OWNER veya ADMIN rolüne sahip olmanız gerekir.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Personel Davet Et</h3>
        <p className="muted mt-1 text-sm">
          STAFF, TRAINER veya VIEWER rolüyle yeni kullanıcı oluşturulur.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <p>{state.success}</p>
          {state.temporaryPassword ? (
            <p className="mt-2">
              Geçici parola: <strong>{state.temporaryPassword}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="muted text-sm">
            Ad Soyad
          </label>
          <input id="name" name="name" className="input" required />
          {state.fieldErrors?.name ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="muted text-sm">
            E-posta
          </label>
          <input id="email" name="email" type="email" className="input" required />
          {state.fieldErrors?.email ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="role" className="muted text-sm">
            Rol
          </label>
          <select id="role" name="role" className="input" required defaultValue="STAFF">
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.role ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.role}</p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-6 py-3 text-sm" disabled={pending}>
            {pending ? 'Ekleniyor…' : 'Personel Ekle'}
          </button>
        </div>
      </form>
    </section>
  );
}
