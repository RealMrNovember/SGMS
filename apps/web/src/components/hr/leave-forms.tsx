'use client';

import { requestLeave, reviewLeave, type HrActionState } from '@/actions/hr';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initial: HrActionState = {};

const LEAVE_TYPES = ['ANNUAL', 'EXCUSED', 'MEDICAL'] as const;

export function LeaveRequestForm() {
  const t = useTranslations('faz22.leaves');
  const [state, action, pending] = useActionState(requestLeave, initial);

  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-lg font-semibold">{t('requestTitle')}</h3>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">{t('type')}</label>
          <select name="type" className="input" defaultValue="ANNUAL">
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('startDate')}</label>
          <input name="startDate" type="date" className="input" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">{t('endDate')}</label>
          <input name="endDate" type="date" className="input" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">{t('reason')}</label>
          <textarea name="reason" className="input min-h-[60px]" />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          {t('submitRequest')}
        </button>
      </form>
    </section>
  );
}

type LeaveRow = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string | null;
  userName: string;
  userEmail: string;
};

export function LeaveReviewActions({ leaveId }: { leaveId: string }) {
  const t = useTranslations('faz22.leaves');
  const [state, action, pending] = useActionState(reviewLeave, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="leaveId" value={leaveId} />
      {state.error ? <p className="w-full text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="w-full text-sm text-emerald-300">{state.success}</p> : null}
      <input
        name="reviewNotes"
        className="input min-w-[140px] flex-1 py-1.5 text-sm"
        placeholder={t('reviewNotesPlaceholder')}
      />
      <button
        type="submit"
        name="decision"
        value="APPROVE"
        className="button py-1.5 text-sm"
        disabled={pending}
      >
        {t('approve')}
      </button>
      <button
        type="submit"
        name="decision"
        value="REJECT"
        className="button-outline-gold py-1.5 text-sm"
        disabled={pending}
      >
        {t('reject')}
      </button>
    </form>
  );
}

export function LeaveList({
  leaves,
  isAdmin,
  showUser,
}: {
  leaves: LeaveRow[];
  isAdmin: boolean;
  showUser?: boolean;
}) {
  const t = useTranslations('faz22.leaves');

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">{isAdmin ? t('listTitleAdmin') : t('listTitle')}</h3>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {leaves.length === 0 ? (
          <p className="muted px-6 py-6 text-center text-sm">{t('empty')}</p>
        ) : (
          leaves.map((leave) => (
            <article key={leave.id} className="space-y-3 px-6 py-4">
              <div>
                {showUser ? (
                  <p className="font-medium">
                    {leave.userName}{' '}
                    <span className="muted text-sm font-normal">({leave.userEmail})</span>
                  </p>
                ) : null}
                <p className="text-sm">
                  <span className="badge mr-2">{t(`types.${leave.type}`)}</span>
                  <span className="badge">{t(`status.${leave.status}`)}</span>
                </p>
                <p className="muted mt-1 text-sm">
                  {leave.startDate} → {leave.endDate}
                  {leave.reason ? ` · ${leave.reason}` : ''}
                </p>
              </div>
              {isAdmin && leave.status === 'PENDING' ? <LeaveReviewActions leaveId={leave.id} /> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
