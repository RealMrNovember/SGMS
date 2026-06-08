'use client';

import { createGymMembershipPlan, type PlanFormState } from '@/actions/plans';
import { useActionState } from 'react';

const initialState: PlanFormState = {};

export function AddPlanForm({ canManage }: { canManage: boolean }) {
  const [state, formAction, pending] = useActionState(createGymMembershipPlan, initialState);

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">Plan yönetimi için OWNER veya ADMIN yetkisi gerekir.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Salon Üyelik Planı</h3>
        <p className="muted mt-1 text-sm">Sporculara atanacak yerel paket tanımlayın.</p>
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

      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="name" className="muted text-sm">
            Plan Adı
          </label>
          <input id="name" name="name" className="input" required />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="muted text-sm">
            Açıklama
          </label>
          <textarea id="description" name="description" rows={2} className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="durationDays" className="muted text-sm">
            Süre (gün)
          </label>
          <input id="durationDays" name="durationDays" type="number" min={1} className="input" required />
        </div>

        <div className="space-y-2">
          <label htmlFor="price" className="muted text-sm">
            Fiyat
          </label>
          <input id="price" name="price" type="number" min={0} step="0.01" className="input" required />
        </div>

        <div className="space-y-2">
          <label htmlFor="currency" className="muted text-sm">
            Para Birimi
          </label>
          <select id="currency" name="currency" className="input" defaultValue="TRY">
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="AZN">AZN</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="sortOrder" className="muted text-sm">
            Sıra
          </label>
          <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={0} className="input" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-5 py-2.5" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Plan Oluştur'}
          </button>
        </div>
      </form>
    </section>
  );
}
