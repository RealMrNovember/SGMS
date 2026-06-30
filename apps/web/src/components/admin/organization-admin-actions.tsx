'use client';

import {
  activateOrganizationSubscription,
  addOrganizationSupportNote,
  changeOrganizationPlan,
  extendOrganizationTrial,
  type AdminActionState,
} from '@/actions/admin-organizations';
import { useActionState } from 'react';

const initial: AdminActionState = {};

type PlanOption = { id: string; name: string; code: string };

export function OrganizationAdminActions({
  organizationId,
  plans,
  isTrialing,
}: {
  organizationId: string;
  plans: PlanOption[];
  isTrialing: boolean;
}) {
  const [extendState, extendAction, extendPending] = useActionState(extendOrganizationTrial, initial);
  const [activateState, activateAction, activatePending] = useActionState(
    activateOrganizationSubscription,
    initial,
  );
  const [planState, planAction, planPending] = useActionState(changeOrganizationPlan, initial);
  const [noteState, noteAction, notePending] = useActionState(addOrganizationSupportNote, initial);

  const feedback = [extendState, activateState, planState, noteState].find(
    (s) => s.error || s.success,
  );

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

      <div className="grid gap-4 lg:grid-cols-2">
        {isTrialing ? (
          <form action={extendAction} className="card space-y-3 p-5">
            <h4 className="font-medium">Deneme süresini uzat</h4>
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="flex gap-2">
              <input
                type="number"
                name="days"
                min={1}
                max={90}
                defaultValue={7}
                className="input w-24"
              />
              <span className="muted self-center text-sm">gün</span>
            </div>
            <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={extendPending}>
              Uzat
            </button>
          </form>
        ) : null}

        <form action={activateAction} className="card space-y-3 p-5">
          <h4 className="font-medium">Ücretli aboneliğe geçir</h4>
          <p className="muted text-sm">Deneme veya askıdaki hesabı 30 günlük aktif pakete alır.</p>
          <input type="hidden" name="organizationId" value={organizationId} />
          <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={activatePending}>
            Aktifleştir
          </button>
        </form>

        <form action={planAction} className="card space-y-3 p-5">
          <h4 className="font-medium">SaaS planını değiştir</h4>
          <input type="hidden" name="organizationId" value={organizationId} />
          <select name="planId" className="input w-full" defaultValue={plans[0]?.id}>
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
