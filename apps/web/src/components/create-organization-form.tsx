'use client';

import { createOrganization, type CreateOrganizationState } from '@/actions/organizations';
import { slugify } from '@/lib/slug';
import { useActionState, useEffect, useState } from 'react';

type PlanOption = {
  id: string;
  name: string;
  code: string;
  priceMonthly: string;
};

const initialState: CreateOrganizationState = {};

export function CreateOrganizationForm({ plans }: { plans: PlanOption[] }) {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setOrganizationSlug(slugify(organizationName));
    }
  }, [organizationName, slugTouched]);

  return (
    <form action={formAction} className="space-y-8">
      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      <section className="card space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">Salon Bilgileri</h3>
          <p className="muted mt-1 text-sm">Yeni GYM kiracısı ve SaaS aboneliği.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="organizationName" className="muted text-sm">
              Salon Adı
            </label>
            <input
              id="organizationName"
              name="organizationName"
              className="input"
              required
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="organizationSlug" className="muted text-sm">
              Slug
            </label>
            <input
              id="organizationSlug"
              name="organizationSlug"
              className="input"
              required
              value={organizationSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setOrganizationSlug(event.target.value);
              }}
            />
            {state.fieldErrors?.organizationSlug ? (
              <p className="text-xs text-rose-400">{state.fieldErrors.organizationSlug}</p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="organizationEmail" className="muted text-sm">
              Salon E-postası (opsiyonel)
            </label>
            <input
              id="organizationEmail"
              name="organizationEmail"
              type="email"
              className="input"
              placeholder="bos birakilirsa sahip e-postasi kullanilir"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="planId" className="muted text-sm">
              Plan
            </label>
            <select id="planId" name="planId" className="input" required defaultValue="">
              <option value="" disabled>
                Plan seçin
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code}) — {plan.priceMonthly} TRY/ay
                </option>
              ))}
            </select>
            {state.fieldErrors?.planId ? (
              <p className="text-xs text-rose-400">{state.fieldErrors.planId}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">Salon Sahibi (OWNER)</h3>
          <p className="muted mt-1 text-sm">
            İlk kullanıcı tenant paneline bu hesapla giriş yapar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ownerName" className="muted text-sm">
              Ad Soyad
            </label>
            <input id="ownerName" name="ownerName" className="input" required />
          </div>

          <div className="space-y-2">
            <label htmlFor="ownerEmail" className="muted text-sm">
              E-posta
            </label>
            <input id="ownerEmail" name="ownerEmail" type="email" className="input" required />
            {state.fieldErrors?.ownerEmail ? (
              <p className="text-xs text-rose-400">{state.fieldErrors.ownerEmail}</p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="ownerPassword" className="muted text-sm">
              Geçici Parola
            </label>
            <input
              id="ownerPassword"
              name="ownerPassword"
              type="password"
              className="input"
              minLength={8}
              required
            />
            {state.fieldErrors?.ownerPassword ? (
              <p className="text-xs text-rose-400">{state.fieldErrors.ownerPassword}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="button button-gold px-6 py-3 text-sm" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Organizasyonu Oluştur'}
        </button>
      </div>
    </form>
  );
}
