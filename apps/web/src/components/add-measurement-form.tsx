'use client';

import { addHealthMeasurement, type AddMeasurementState } from '@/actions/measurements';
import { useActionState } from 'react';

const initialState: AddMeasurementState = {};

export function AddMeasurementForm({
  gymMemberId,
  canManage,
}: {
  gymMemberId: string;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(addHealthMeasurement, initialState);

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">Ölçüm ekleme yetkiniz yok.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Ölçüm</h3>
        <p className="muted mt-1 text-sm">Kilo, yağ oranı, kas kütlesi veya boy kaydı.</p>
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
        <input type="hidden" name="gymMemberId" value={gymMemberId} />

        <div className="space-y-2">
          <label htmlFor="weight" className="muted text-sm">
            Kilo (kg)
          </label>
          <input id="weight" name="weight" type="number" step="0.1" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="bodyFatPercentage" className="muted text-sm">
            Yağ Oranı (%)
          </label>
          <input
            id="bodyFatPercentage"
            name="bodyFatPercentage"
            type="number"
            step="0.1"
            className="input"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="muscleMass" className="muted text-sm">
            Kas Kütlesi (kg)
          </label>
          <input id="muscleMass" name="muscleMass" type="number" step="0.1" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="height" className="muted text-sm">
            Boy (cm)
          </label>
          <input id="height" name="height" type="number" step="0.1" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="measuredAt" className="muted text-sm">
            Ölçüm Tarihi
          </label>
          <input id="measuredAt" name="measuredAt" type="datetime-local" className="input" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="muted text-sm">
            Not
          </label>
          <textarea id="notes" name="notes" rows={2} className="input" />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-5 py-2.5" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Ölçüm Kaydet'}
          </button>
        </div>
      </form>
    </section>
  );
}
