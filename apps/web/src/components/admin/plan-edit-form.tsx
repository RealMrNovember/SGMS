'use client';

import { updateSaasPlan, type PlanActionState } from '@/actions/admin-plans';
import { useActionState } from 'react';

const initial: PlanActionState = {};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  priceMonthly: string;
  priceYearly: string;
  maxMembers: number;
  maxStaff: number;
  maxDevices: number;
  isActive: boolean;
  sortOrder: number;
};

export function PlanEditForm({ plan }: { plan: PlanRow }) {
  const [state, action, pending] = useActionState(updateSaasPlan, initial);

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="admin-kicker">{plan.code}</p>
          <p className="muted text-xs">{plan.currency}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={plan.isActive} />
          Aktif
        </label>
      </div>

      {state.error ? (
        <p className="text-sm text-rose-300">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-300">{state.success}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="muted text-xs">Ad</label>
          <input name="name" defaultValue={plan.name} className="input w-full" required />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Sıra</label>
          <input name="sortOrder" type="number" defaultValue={plan.sortOrder} className="input w-full" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="muted text-xs">Açıklama</label>
          <input name="description" defaultValue={plan.description ?? ''} className="input w-full" />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Aylık fiyat</label>
          <input name="priceMonthly" type="number" step="0.01" defaultValue={plan.priceMonthly} className="input w-full" />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Yıllık fiyat</label>
          <input name="priceYearly" type="number" step="0.01" defaultValue={plan.priceYearly} className="input w-full" />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Max üye</label>
          <input name="maxMembers" type="number" defaultValue={plan.maxMembers} className="input w-full" />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Max personel</label>
          <input name="maxStaff" type="number" defaultValue={plan.maxStaff} className="input w-full" />
        </div>
        <div className="space-y-1">
          <label className="muted text-xs">Max cihaz</label>
          <input name="maxDevices" type="number" defaultValue={plan.maxDevices} className="input w-full" />
        </div>
      </div>

      <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}
