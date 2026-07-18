'use client';

import { acceptStaffInvite, type AcceptStaffInviteState } from '@/actions/staff-invite';
import Link from 'next/link';
import { useActionState } from 'react';

const initialState: AcceptStaffInviteState = {};

export function StaffInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptStaffInvite, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
        <Link href="/login" className="button button-gold block w-full text-center">
          Giriş yap
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label htmlFor="password" className="muted text-sm">
          Parolanızı belirleyin
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="passwordConfirmation" className="muted text-sm">
          Parola (tekrar)
        </label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
      </div>

      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}

      <button type="submit" className="button button-gold w-full" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Parolayı belirle ve devam et'}
      </button>
    </form>
  );
}
