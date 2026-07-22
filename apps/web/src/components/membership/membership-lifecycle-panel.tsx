'use client';

import {
  approveMembershipFreeze,
  cancelMembership,
  creditRemainingRights,
  rejectMembershipFreeze,
  requestMembershipFreeze,
  transferMembership,
  unfreezeMembership,
  type LifecycleActionState,
} from '@/actions/membership-lifecycle';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';

type PendingFreeze = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  notes: string | null;
  gymMemberName: string;
};

type MemberOption = {
  id: string;
  label: string;
};

const initial: LifecycleActionState = {};

export function MembershipLifecyclePanel({
  gymMemberId,
  memberName,
  memberStatus,
  pendingFreezes,
  memberOptions,
  canManage,
  isAthleteView = false,
  suggestedCancelRefund = 0,
}: {
  gymMemberId: string;
  memberName: string;
  memberStatus: string;
  pendingFreezes: PendingFreeze[];
  memberOptions: MemberOption[];
  canManage: boolean;
  isAthleteView?: boolean;
  suggestedCancelRefund?: number;
}) {
  const t = useTranslations('faz17.freezes');
  const [freezeState, freezeAction, freezePending] = useActionState(requestMembershipFreeze, initial);
  const [transferState, transferAction, transferPending] = useActionState(transferMembership, initial);
  const [creditState, creditAction, creditPending] = useActionState(creditRemainingRights, initial);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelMembership, initial);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {(canManage || isAthleteView) && memberStatus === 'ACTIVE' ? (
        <section className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold">{t('requestTitle')}</h3>
          {freezeState.error ? <p className="text-sm text-rose-300">{freezeState.error}</p> : null}
          {freezeState.success ? <p className="text-sm text-emerald-300">{freezeState.success}</p> : null}
          <form action={freezeAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="gymMemberId" value={gymMemberId} />
            <div className="space-y-2">
              <label className="muted text-sm">{t('startDate')}</label>
              <input type="date" name="startDate" className="input" required />
            </div>
            <div className="space-y-2">
              <label className="muted text-sm">{t('endDate')}</label>
              <input type="date" name="endDate" className="input" required />
            </div>
            <div className="space-y-2">
              <label className="muted text-sm">{t('reason')}</label>
              <select name="reason" className="input" defaultValue="OTHER">
                <option value="MILITARY">{t('reasons.MILITARY')}</option>
                <option value="MEDICAL">{t('reasons.MEDICAL')}</option>
                <option value="TRAVEL">{t('reasons.TRAVEL')}</option>
                <option value="OTHER">{t('reasons.OTHER')}</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="muted text-sm">{t('notes')}</label>
              <textarea name="notes" className="input min-h-[80px]" maxLength={1000} />
            </div>
            <button type="submit" className="button md:col-span-2" disabled={freezePending}>
              {t('submitRequest')}
            </button>
          </form>
        </section>
      ) : null}

      {canManage && memberStatus === 'FROZEN' ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">{t('unfreezeTitle')}</h3>
          <p className="muted mt-2 text-sm">{t('unfreezeHint', { name: memberName })}</p>
          <button
            type="button"
            className="button mt-4"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void unfreezeMembership(gymMemberId);
              })
            }
          >
            {t('unfreeze')}
          </button>
        </section>
      ) : null}

      {canManage && pendingFreezes.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-lg font-semibold">{t('pendingTitle')}</h3>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {pendingFreezes.map((freeze) => (
              <li key={freeze.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{freeze.gymMemberName}</p>
                  <p className="muted text-sm">
                    {freeze.startDate.slice(0, 10)} → {freeze.endDate.slice(0, 10)} · {freeze.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button py-2 text-sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void approveMembershipFreeze(freeze.id);
                      })
                    }
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    className="button py-2 text-sm opacity-70"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void rejectMembershipFreeze(freeze.id);
                      })
                    }
                  >
                    {t('reject')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <>
          <section className="card space-y-4 p-6">
            <h3 className="text-lg font-semibold">{t('transferTitle')}</h3>
            {transferState.error ? <p className="text-sm text-rose-300">{transferState.error}</p> : null}
            {transferState.success ? <p className="text-sm text-emerald-300">{transferState.success}</p> : null}
            <form action={transferAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="muted text-sm">{t('fromMember')}</label>
                <select name="fromMemberId" className="input" defaultValue={gymMemberId} required>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="muted text-sm">{t('toMember')}</label>
                <select name="toMemberId" className="input" required defaultValue="">
                  <option value="" disabled>
                    {t('selectMember')}
                  </option>
                  {memberOptions
                    .filter((m) => m.id !== gymMemberId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="muted text-sm">{t('creditAmount')}</label>
                <input type="number" name="creditAmount" className="input" min={0} step="0.01" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="muted text-sm">{t('notes')}</label>
                <textarea name="notes" className="input min-h-[60px]" />
              </div>
              <button type="submit" className="button md:col-span-2" disabled={transferPending}>
                {t('transferSubmit')}
              </button>
            </form>
          </section>

          <section className="card space-y-4 p-6">
            <h3 className="text-lg font-semibold">{t('creditTitle')}</h3>
            {creditState.error ? <p className="text-sm text-rose-300">{creditState.error}</p> : null}
            {creditState.success ? <p className="text-sm text-emerald-300">{creditState.success}</p> : null}
            <form action={creditAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="gymMemberId" value={gymMemberId} />
              <div className="space-y-2">
                <label className="muted text-sm">{t('creditAmount')}</label>
                <input type="number" name="creditAmount" className="input" min={0.01} step="0.01" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="muted text-sm">{t('notes')}</label>
                <textarea name="notes" className="input min-h-[60px]" />
              </div>
              <button type="submit" className="button md:col-span-2" disabled={creditPending}>
                {t('creditSubmit')}
              </button>
            </form>
          </section>

          {memberStatus !== 'INACTIVE' ? (
            <section className="card space-y-4 border-rose-500/30 p-6">
              <h3 className="text-lg font-semibold text-rose-100">Üyeliği İptal Et</h3>
              <p className="muted text-sm">
                Üye pasife alınır. Önerilen oranlı iade: {suggestedCancelRefund.toFixed(2)} ₺ (isteğe bağlı —
                0 bırakırsanız yalnızca iptal edilir).
              </p>
              {cancelState.error ? <p className="text-sm text-rose-300">{cancelState.error}</p> : null}
              {cancelState.success ? <p className="text-sm text-emerald-300">{cancelState.success}</p> : null}
              <form
                action={cancelAction}
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(e) => {
                  if (!window.confirm(`${memberName} üyeliğini iptal etmek istediğinize emin misiniz?`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="gymMemberId" value={gymMemberId} />
                <div className="space-y-2">
                  <label className="muted text-sm">İade / mahsup tutarı (₺)</label>
                  <input
                    type="number"
                    name="refundAmount"
                    className="input"
                    min={0}
                    step="0.01"
                    defaultValue={suggestedCancelRefund > 0 ? suggestedCancelRefund : 0}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="muted text-sm">{t('notes')}</label>
                  <textarea name="notes" className="input min-h-[60px]" />
                </div>
                <button
                  type="submit"
                  className="button border-rose-400/50 bg-rose-500/20 md:col-span-2"
                  disabled={cancelPending}
                >
                  Üyeliği İptal Et
                </button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
