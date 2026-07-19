'use client';

import { completeTwoFactorRecovery, type CompleteTwoFactorRecoveryState } from '@/actions/two-factor';
import Link from 'next/link';
import { useActionState } from 'react';

const initialState: CompleteTwoFactorRecoveryState = {};

export function ResetTwoFactorForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completeTwoFactorRecovery, initialState);

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

      <p className="muted text-sm leading-6">
        Onayladığınızda hesabınızdaki mevcut 2FA kurulumu (authenticator ve yedek kodlar) tamamen
        kaldırılır. Giriş yaptıktan sonra 2FA&apos;yı yeniden kurmanız istenecektir.
      </p>

      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}

      <button type="submit" className="button button-gold w-full" disabled={pending}>
        {pending ? 'Sıfırlanıyor…' : "2FA'yı sıfırla"}
      </button>
    </form>
  );
}
