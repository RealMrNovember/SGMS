'use client';

import { issueGuestPass, revokeGuestPass } from '@/actions/guest-passes';
import QRCode from 'react-qr-code';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

export function GuestPassIssueForm({ members }: { members: { id: string; label: string }[] }) {
  const t = useTranslations('faz17.guestPass');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-6">
        <h3 className="text-lg font-semibold">{t('issueTitle')}</h3>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              setError(null);
              setSuccess(null);
              const result = await issueGuestPass({}, fd);
              if (result.error) setError(result.error);
              if (result.success) setSuccess(result.success);
              if (result.token) setIssuedToken(result.token);
            });
          }}
        >
          <div className="space-y-2">
            <label className="muted text-sm">{t('guestName')}</label>
            <input name="guestName" className="input" required />
          </div>
          <div className="space-y-2">
            <label className="muted text-sm">{t('guestPhone')}</label>
            <input name="guestPhone" className="input" />
          </div>
          <div className="space-y-2">
            <label className="muted text-sm">{t('hostMember')}</label>
            <select name="hostMemberId" className="input" defaultValue="">
              <option value="">{t('noHost')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="muted text-sm">{t('validFrom')}</label>
            <input
              name="validFrom"
              type="datetime-local"
              className="input"
              defaultValue={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="muted text-sm">{t('validUntil')}</label>
            <input
              name="validUntil"
              type="datetime-local"
              className="input"
              defaultValue={tomorrow.toISOString().slice(0, 16)}
              required
            />
          </div>
          <button type="submit" className="button md:col-span-2" disabled={pending}>
            {t('issueSubmit')}
          </button>
        </form>
      </section>

      {issuedToken ? (
        <section className="card flex flex-col items-center gap-4 p-6">
          <h3 className="text-lg font-semibold">{t('qrTitle')}</h3>
          <p className="muted text-center text-sm">{t('qrHint')}</p>
          <div className="rounded-xl bg-white p-4">
            <QRCode value={issuedToken} size={200} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function GuestPassRevokeButton({ passId }: { passId: string }) {
  const t = useTranslations('faz17.guestPass');
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button py-1 text-xs opacity-80"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void revokeGuestPass(passId);
        })
      }
    >
      {t('revoke')}
    </button>
  );
}
