'use client';

import { sendDirectMessage, type SendMessageState } from '@/actions/messages';
import { useActionState } from 'react';

const initialState: SendMessageState = {};

type RecipientOption = { id: string; label: string };

export function SendMessageForm({ recipients }: { recipients: RecipientOption[] }) {
  const [state, formAction, pending] = useActionState(sendDirectMessage, initialState);

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Mesaj</h3>
        <p className="muted mt-1 text-sm">Personel veya sporcu ile mesajlaşın.</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="receiverId" className="muted text-sm">
            Alıcı
          </label>
          <select id="receiverId" name="receiverId" className="input" required>
            <option value="">Seçin</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="content" className="muted text-sm">
            Mesaj
          </label>
          <textarea id="content" name="content" rows={4} className="input" required />
        </div>

        <button type="submit" className="button px-5 py-2.5" disabled={pending}>
          {pending ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </form>
    </section>
  );
}
