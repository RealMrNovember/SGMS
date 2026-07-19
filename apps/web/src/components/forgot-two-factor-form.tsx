'use client';

import { requestTwoFactorRecovery, type TwoFactorRecoveryRequestState } from '@/actions/two-factor';
import Link from 'next/link';
import { useActionState } from 'react';

const initialState: TwoFactorRecoveryRequestState = {};

export function ForgotTwoFactorForm() {
  const [state, formAction, pending] = useActionState(requestTwoFactorRecovery, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
        <Link href="/login" className="muted text-sm hover:text-white">
          ← Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="muted text-sm">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="ornek@salon.com"
        />
      </div>

      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}

      <button type="submit" className="button button-gold w-full" disabled={pending}>
        {pending ? 'Gönderiliyor…' : '2FA kurtarma bağlantısı gönder'}
      </button>

      <Link href="/login" className="muted block text-center text-sm hover:text-white">
        ← Girişe dön
      </Link>
    </form>
  );
}
