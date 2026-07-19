'use client';

import {
  extendMembershipManually,
  renewMembership,
  type MembershipActionState,
} from '@/actions/membership';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

type PlanOption = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  currency: string;
};

const renewInitial: MembershipActionState = {};
const extendInitial: MembershipActionState = {};

export function MembershipRenewalPanel({
  gymMemberId,
  currentPlanId,
  membershipEndsAt,
  plans,
  canSell,
  canExtendFree,
}: {
  gymMemberId: string;
  currentPlanId: string | null;
  membershipEndsAt: string | null;
  plans: PlanOption[];
  canSell: boolean;
  canExtendFree: boolean;
}) {
  const t = useTranslations('members.renewal');
  const [renewState, renewAction, renewPending] = useActionState(renewMembership, renewInitial);
  const [extendState, extendAction, extendPending] = useActionState(
    extendMembershipManually,
    extendInitial,
  );
  const [paymentMode, setPaymentMode] = useState<'charge_open' | 'pay_now'>('pay_now');
  const [selectedPlanId, setSelectedPlanId] = useState(
    currentPlanId && plans.some((p) => p.id === currentPlanId)
      ? currentPlanId
      : (plans[0]?.id ?? ''),
  );

  if (!canSell && !canExtendFree) {
    return null;
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const endsLabel = membershipEndsAt
    ? new Date(membershipEndsAt).toLocaleDateString()
    : t('noEndDate');

  return (
    <section className="card space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="muted mt-1 text-sm">{t('subtitle', { ends: endsLabel })}</p>
      </div>

      {canSell ? (
        <form action={renewAction} className="space-y-4 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="gymMemberId" value={gymMemberId} />
          <h4 className="text-sm font-semibold">{t('sellTitle')}</h4>
          <p className="muted text-xs">{t('sellHint')}</p>

          {renewState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {renewState.error}
            </p>
          ) : null}
          {renewState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {renewState.success}
            </p>
          ) : null}

          {plans.length === 0 ? (
            <p className="muted text-sm">{t('noPlans')}</p>
          ) : (
            <>
              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="renew-plan">
                  {t('plan')}
                </label>
                <select
                  id="renew-plan"
                  name="planId"
                  className="input w-full"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  required
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {t('planOption', {
                        name: plan.name,
                        days: plan.durationDays,
                        price: plan.price,
                        currency: plan.currency,
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlan ? (
                <p className="muted text-xs">
                  {t('stackHint', { days: selectedPlan.durationDays })}
                </p>
              ) : null}

              <fieldset className="space-y-2">
                <legend className="muted text-xs">{t('paymentMode')}</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMode"
                    value="pay_now"
                    checked={paymentMode === 'pay_now'}
                    onChange={() => setPaymentMode('pay_now')}
                  />
                  {t('payNow')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMode"
                    value="charge_open"
                    checked={paymentMode === 'charge_open'}
                    onChange={() => setPaymentMode('charge_open')}
                  />
                  {t('chargeOpen')}
                </label>
              </fieldset>

              {paymentMode === 'pay_now' ? (
                <div className="space-y-1">
                  <label className="muted text-xs" htmlFor="renew-method">
                    {t('paymentMethod')}
                  </label>
                  <select id="renew-method" name="paymentMethod" className="input w-full" required>
                    <option value="CASH">{t('methods.cash')}</option>
                    <option value="CARD">{t('methods.card')}</option>
                    <option value="TRANSFER">{t('methods.transfer')}</option>
                  </select>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="muted text-xs" htmlFor="renew-notes">
                  {t('notes')}
                </label>
                <input
                  id="renew-notes"
                  name="notes"
                  className="input w-full"
                  placeholder={t('notesPlaceholder')}
                  maxLength={500}
                />
              </div>

              <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={renewPending}>
                {renewPending ? t('selling') : t('sellSubmit')}
              </button>
            </>
          )}
        </form>
      ) : null}

      {canExtendFree ? (
        <form action={extendAction} className="space-y-4 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="gymMemberId" value={gymMemberId} />
          <h4 className="text-sm font-semibold">{t('extendTitle')}</h4>
          <p className="muted text-xs">{t('extendHint')}</p>

          {extendState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {extendState.error}
            </p>
          ) : null}
          {extendState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {extendState.success}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="muted text-xs" htmlFor="extend-days">
                {t('extraDays')}
              </label>
              <input
                id="extend-days"
                name="extraDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={7}
                className="input w-full"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="muted text-xs" htmlFor="extend-reason">
                {t('reason')}
              </label>
              <input
                id="extend-reason"
                name="reason"
                className="input w-full"
                placeholder={t('reasonPlaceholder')}
                required
                minLength={3}
                maxLength={500}
              />
            </div>
          </div>

          <button type="submit" className="button px-4 py-2 text-sm" disabled={extendPending}>
            {extendPending ? t('extending') : t('extendSubmit')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
