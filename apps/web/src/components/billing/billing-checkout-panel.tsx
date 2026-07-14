'use client';

import { startCardCheckout, submitBillingRequest, type BillingActionState, type CardCheckoutState } from '@/actions/billing';
import { siteConfig } from '@/lib/site-config';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

type PlanOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  maxMembers: number;
  maxStaff: number;
};

const initial: BillingActionState = {};

function formatMoney(value: string, currency: string) {
  const num = Number(value);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

function buildWhatsAppUrl(orgName: string, planName: string, cycle: string, amount: string) {
  const text = [
    'Merhaba CiCiByte SGMS,',
    '',
    `Salon: ${orgName}`,
    `Paket: ${planName} (${cycle === 'YEARLY' ? 'Yıllık' : 'Aylık'})`,
    `Tutar: ${amount}`,
    '',
    'Deneme sürem sona erdi / ödeme yapmak istiyorum. Destek rica ederim.',
  ].join('\n');

  return `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function BillingCheckoutPanel({
  organizationName,
  plans,
  hasPendingRequest,
  locked,
}: {
  organizationName: string;
  plans: PlanOption[];
  hasPendingRequest: boolean;
  locked: boolean;
}) {
  const t = useTranslations('billing');
  const [state, formAction, pending] = useActionState(submitBillingRequest, initial);
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(
    startCardCheckout,
    {} as CardCheckoutState,
  );
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? '');
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0];
  const displayAmount = selected
    ? formatMoney(cycle === 'YEARLY' ? selected.priceYearly : selected.priceMonthly, selected.currency)
    : '—';

  const whatsappHref =
    selected && locked
      ? buildWhatsAppUrl(organizationName, selected.name, cycle, displayAmount)
      : `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(`Merhaba, ${organizationName} salonu için SGMS aboneliği hakkında bilgi almak istiyorum.`)}`;

  return (
    <div className="space-y-8">
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

      {hasPendingRequest ? (
        <section className="card border border-amber-500/30 bg-amber-500/10 p-6">
          <h3 className="font-semibold text-amber-100">{t('pendingTitle')}</h3>
          <p className="muted mt-2 text-sm leading-7">{t('pendingHint')}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const active = plan.id === selectedPlanId;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`card text-left p-5 transition ${active ? 'ring-2 ring-[var(--admin-gold,#c9a962)]' : 'opacity-90 hover:opacity-100'}`}
            >
              <p className="admin-kicker">{plan.code}</p>
              <h3 className="mt-2 text-lg font-semibold">{plan.name}</h3>
              {plan.description ? (
                <p className="muted mt-2 text-xs leading-6">{plan.description}</p>
              ) : null}
              <p className="mt-4 text-2xl font-semibold">
                {formatMoney(plan.priceMonthly, plan.currency)}
                <span className="muted text-sm font-normal"> / {t('monthly')}</span>
              </p>
              <p className="muted mt-1 text-xs">
                {t('limits', { members: plan.maxMembers, staff: plan.maxStaff })}
              </p>
            </button>
          );
        })}
      </section>

      <section className="card grid gap-6 p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('selectCycle')}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className={`button px-4 py-2 text-sm ${cycle === 'MONTHLY' ? 'button-gold' : ''}`}
              onClick={() => setCycle('MONTHLY')}
            >
              {t('monthly')}
            </button>
            <button
              type="button"
              className={`button px-4 py-2 text-sm ${cycle === 'YEARLY' ? 'button-gold' : ''}`}
              onClick={() => setCycle('YEARLY')}
            >
              {t('yearly')}
            </button>
          </div>
          <p className="text-3xl font-semibold">{displayAmount}</p>

          <form action={checkoutAction} className="space-y-2">
            <input type="hidden" name="planId" value={selectedPlanId} />
            <input type="hidden" name="billingCycle" value={cycle} />
            {checkoutState.error ? (
              <p className="text-sm text-rose-400">{checkoutState.error}</p>
            ) : null}
            <button
              type="submit"
              className="button button-gold w-full px-4 py-3 text-sm"
              disabled={checkoutPending || !selectedPlanId}
            >
              {checkoutPending ? t('startingCheckout') : t('payWithCard')}
            </button>
            <p className="muted text-xs">{t('payWithCardHint')}</p>
          </form>

          <p className="muted text-sm">{t('bankSoon')}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('requestTitle')}</h3>
          <p className="muted text-sm leading-7">{t('requestHint')}</p>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="planId" value={selectedPlanId} />
            <input type="hidden" name="billingCycle" value={cycle} />
            <textarea
              name="notes"
              rows={3}
              className="input w-full resize-y"
              placeholder={t('notesPlaceholder')}
            />
            <button
              type="submit"
              className="button button-gold w-full px-4 py-3 text-sm"
              disabled={pending || hasPendingRequest || !selectedPlanId}
            >
              {pending ? t('submitting') : t('submitRequest')}
            </button>
          </form>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h3 className="text-lg font-semibold">{t('whatsappTitle')}</h3>
        <p className="muted text-sm leading-7">{t('whatsappHint')}</p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="button inline-flex w-full items-center justify-center gap-2 bg-[#25D366] px-4 py-3 text-sm font-medium text-white hover:opacity-95 md:w-auto"
        >
          {t('whatsappButton')}
        </a>
      </section>
    </div>
  );
}
