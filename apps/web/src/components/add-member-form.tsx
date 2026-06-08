'use client';

import { addGymMember, type AddGymMemberState } from '@/actions/members';
import { useActionState } from 'react';

const initialState: AddGymMemberState = {};

type PlanOption = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
};

export function AddMemberForm({
  canManage,
  plans,
}: {
  canManage: boolean;
  plans: PlanOption[];
}) {
  const [state, formAction, pending] = useActionState(addGymMember, initialState);

  if (!canManage) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">
          Üye eklemek için OWNER, ADMIN veya STAFF rolüne sahip olmanız gerekir.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Yeni Sporcu / Üye Kaydı</h3>
        <p className="muted mt-1 text-sm">
          Salon üyelik planı atayarak sporcu kaydı oluşturun.
        </p>
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
        <div className="space-y-2">
          <label htmlFor="firstName" className="muted text-sm">
            Ad
          </label>
          <input id="firstName" name="firstName" className="input" required />
          {state.fieldErrors?.firstName ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.firstName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="lastName" className="muted text-sm">
            Soyad
          </label>
          <input id="lastName" name="lastName" className="input" required />
          {state.fieldErrors?.lastName ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.lastName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="nationalId" className="muted text-sm">
            TC Kimlik No
          </label>
          <input
            id="nationalId"
            name="nationalId"
            className="input"
            inputMode="numeric"
            pattern="\d{11}"
            placeholder="11 haneli"
          />
          {state.fieldErrors?.nationalId ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.nationalId}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="muted text-sm">
            Telefon
          </label>
          <input id="phone" name="phone" type="tel" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="muted text-sm">
            E-posta
          </label>
          <input id="email" name="email" type="email" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="birthDate" className="muted text-sm">
            Doğum Tarihi
          </label>
          <input id="birthDate" name="birthDate" type="date" className="input" />
        </div>

        <div className="space-y-2">
          <label htmlFor="gender" className="muted text-sm">
            Cinsiyet
          </label>
          <select id="gender" name="gender" className="input" defaultValue="UNSPECIFIED">
            <option value="UNSPECIFIED">Belirtilmedi</option>
            <option value="MALE">Erkek</option>
            <option value="FEMALE">Kadın</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="muted text-sm">
            Kayıt Durumu
          </label>
          <select id="status" name="status" className="input" defaultValue="ACTIVE">
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="planId" className="muted text-sm">
            Salon Üyelik Planı
          </label>
          <select id="planId" name="planId" className="input" defaultValue="">
            <option value="">Plan seçilmedi</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.durationDays} gün — {plan.price} TRY
              </option>
            ))}
          </select>
          {state.fieldErrors?.planId ? (
            <p className="text-xs text-rose-400">{state.fieldErrors.planId}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="membershipStartsAt" className="muted text-sm">
            Üyelik Başlangıcı
          </label>
          <input
            id="membershipStartsAt"
            name="membershipStartsAt"
            type="date"
            className="input"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="muted text-sm">
            Notlar (opsiyonel)
          </label>
          <textarea id="notes" name="notes" className="input min-h-24 resize-y" rows={3} />
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="button px-6 py-3 text-sm" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Üyeyi Kaydet'}
          </button>
        </div>
      </form>
    </section>
  );
}
