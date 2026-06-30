'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

export function ManualCheckInForm({ members }: { members: { id: string; name: string }[] }) {
  const t = useTranslations('checkIn.manual');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!memberId) {
      return;
    }
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch('/api/v1/check-in', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gymMemberId: memberId }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string; data?: { duplicateWithinHour?: boolean } };
        if (!res.ok || !json.ok) {
          setMessage({ type: 'err', text: json.error ?? t('error') });
          return;
        }
        setMessage({
          type: 'ok',
          text: json.data?.duplicateWithinHour ? t('successDuplicate') : t('success'),
        });
        setMemberId('');
      } catch {
        setMessage({ type: 'err', text: t('error') });
      }
    });
  };

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === 'ok'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="input flex-1"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        >
          <option value="">{t('selectMember')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button px-4 py-2 text-sm"
          disabled={!memberId || pending}
          onClick={submit}
        >
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </section>
  );
}
