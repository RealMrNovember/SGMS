'use client';

import {
  activateOrganizationSubscription,
  addOrganizationSupportNote,
  cancelOrganizationSubscription,
  changeOrganizationPlan,
  extendOrganizationTrial,
  setOrganizationSubscription,
  type AdminActionState,
} from '@/actions/admin-organizations';
import { formatDateTr } from '@/lib/admin/format';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

type PlanOption = { id: string; name: string; code: string };

type SubscriptionInfo = {
  id: string;
  status: string;
  billingCycle: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  planId: string;
};

type Props = {
  organizationId: string;
  plans: PlanOption[];
  subscription: SubscriptionInfo | null;
  isTrialing: boolean;
};

export function OrganizationSubscriptionPanel({
  organizationId,
  plans,
  subscription,
  isTrialing,
}: Props) {
  const router = useRouter();
  const [extendState, extendAction, extendPending] = useActionState(extendOrganizationTrial, {} as AdminActionState);
  const [activateState, activateAction, activatePending] = useActionState(
    activateOrganizationSubscription,
    {} as AdminActionState,
  );
  const [planState, planAction, planPending] = useActionState(changeOrganizationPlan, {} as AdminActionState);
  const [periodState, periodAction, periodPending] = useActionState(
    setOrganizationSubscription,
    {} as AdminActionState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelOrganizationSubscription,
    {} as AdminActionState,
  );
  const [noteState, noteAction, notePending] = useActionState(addOrganizationSupportNote, {} as AdminActionState);

  const periodEndDefault =
    subscription?.trialEndsAt ?? subscription?.currentPeriodEnd ?? new Date(Date.now() + 14 * 86400000);
  const periodEndValue = periodEndDefault.toISOString().slice(0, 10);

  const feedback = [extendState, activateState, planState, periodState, cancelState, noteState].find(
    (s) => s.error || s.success,
  );

  useEffect(() => {
    if (feedback?.success) {
      router.refresh();
    }
  }, [feedback?.success, router]);

  return (
    <div className="space-y-6">
      {feedback?.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {feedback.error}
        </p>
      ) : null}
      {feedback?.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {feedback.success}
        </p>
      ) : null}

      <form action={periodAction} className="card space-y-4 p-5">
        <div>
          <h4 className="font-medium">Abonelik & paket yönetimi</h4>
          <p className="muted mt-1 text-sm">
            Plan, durum, fatura dönemi ve bitiş tarihini tek formdan güncelleyin.
          </p>
        </div>
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="muted">Paket</span>
            <select name="planId" className="input w-full" defaultValue={subscription?.planId ?? plans[0]?.id}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="muted">Durum</span>
            <select name="status" className="input w-full" defaultValue={subscription?.status ?? 'TRIALING'}>
              <option value="TRIALING">Deneme</option>
              <option value="ACTIVE">Aktif (ücretli)</option>
              <option value="PAST_DUE">Gecikmiş</option>
              <option value="EXPIRED">Süresi dolmuş</option>
              <option value="CANCELED">İptal</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="muted">Fatura dönemi</span>
            <select name="billingCycle" className="input w-full" defaultValue={subscription?.billingCycle ?? 'MONTHLY'}>
              <option value="MONTHLY">Aylık</option>
              <option value="YEARLY">Yıllık</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="muted">Bitiş tarihi</span>
            <input name="periodEnd" type="date" className="input w-full" defaultValue={periodEndValue} />
          </label>
        </div>
        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={periodPending}>
          Aboneliği kaydet
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {isTrialing ? (
          <form action={extendAction} className="card space-y-3 p-5">
            <h4 className="font-medium">Hızlı deneme uzatma</h4>
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="flex gap-2">
              <input type="number" name="days" min={1} max={90} defaultValue={7} className="input w-24" />
              <span className="muted self-center text-sm">gün ekle</span>
            </div>
            <p className="muted text-xs">Mevcut bitiş: {formatDateTr(subscription?.trialEndsAt)}</p>
            <button type="submit" className="button px-4 py-2 text-sm" disabled={extendPending}>
              Uzat
            </button>
          </form>
        ) : null}

        <form action={activateAction} className="card space-y-3 p-5">
          <h4 className="font-medium">30 günlük ücretli aktivasyon</h4>
          <p className="muted text-sm">Deneme veya askıdaki hesabı hızlıca aktif pakete alır.</p>
          <input type="hidden" name="organizationId" value={organizationId} />
          <button type="submit" className="button px-4 py-2 text-sm" disabled={activatePending}>
            Aktifleştir
          </button>
        </form>

        <form action={planAction} className="card space-y-3 p-5">
          <h4 className="font-medium">Sadece plan değiştir</h4>
          <input type="hidden" name="organizationId" value={organizationId} />
          <select name="planId" className="input w-full" defaultValue={subscription?.planId ?? plans[0]?.id}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.code})
              </option>
            ))}
          </select>
          <button type="submit" className="button px-4 py-2 text-sm" disabled={planPending}>
            Planı güncelle
          </button>
        </form>

        <form action={cancelAction} className="card space-y-3 p-5">
          <h4 className="font-medium">Aboneliği iptal et</h4>
          <p className="muted text-sm">Lisans REVOKED olarak işaretlenir; salon erişimi kısıtlanır.</p>
          <input type="hidden" name="organizationId" value={organizationId} />
          <button type="submit" className="button px-4 py-2 text-sm text-rose-200" disabled={cancelPending}>
            İptal et
          </button>
        </form>

        <form action={noteAction} className="card space-y-3 p-5 lg:col-span-2">
          <h4 className="font-medium">Destek notu ekle</h4>
          <input type="hidden" name="organizationId" value={organizationId} />
          <textarea
            name="text"
            rows={3}
            className="input w-full resize-y"
            placeholder="Müşteri görüşmesi, sorun özeti, çözüm adımları…"
            required
          />
          <button type="submit" className="button px-4 py-2 text-sm" disabled={notePending}>
            Notu kaydet
          </button>
        </form>
      </div>
    </div>
  );
}
