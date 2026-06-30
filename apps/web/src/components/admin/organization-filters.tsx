'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function OrganizationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';
  const subscription = searchParams.get('subscription') ?? '';
  const license = searchParams.get('license') ?? '';

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const nextQ = String(formData.get('q') ?? '').trim();
    const nextStatus = String(formData.get('status') ?? '');
    const nextSub = String(formData.get('subscription') ?? '');
    const nextLicense = String(formData.get('license') ?? '');

    if (nextQ) params.set('q', nextQ);
    if (nextStatus) params.set('status', nextStatus);
    if (nextSub) params.set('subscription', nextSub);
    if (nextLicense) params.set('license', nextLicense);

    startTransition(() => {
      router.push(`/admin/organizations?${params.toString()}`);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-2 xl:col-span-2">
        <label htmlFor="q" className="muted text-xs uppercase tracking-wide">
          Ara
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Salon, slug, e-posta…"
          className="input w-full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="status" className="muted text-xs uppercase tracking-wide">
          Org durumu
        </label>
        <select id="status" name="status" defaultValue={status} className="input w-full">
          <option value="">Tümü</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PENDING">Beklemede</option>
          <option value="SUSPENDED">Askıda</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="subscription" className="muted text-xs uppercase tracking-wide">
          Abonelik
        </label>
        <select id="subscription" name="subscription" defaultValue={subscription} className="input w-full">
          <option value="">Tümü</option>
          <option value="trial">Deneme</option>
          <option value="paid">Ücretli</option>
          <option value="PAST_DUE">Gecikmiş</option>
          <option value="EXPIRED">Süresi dolmuş</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="license" className="muted text-xs uppercase tracking-wide">
          Merkezi lisans
        </label>
        <select id="license" name="license" defaultValue={license} className="input w-full">
          <option value="">Tümü</option>
          <option value="TRIAL">Deneme</option>
          <option value="ACTIVE">Aktif</option>
          <option value="EXPIRED">Süresi dolmuş</option>
          <option value="REVOKED">İptal</option>
          <option value="UNKNOWN">Bilinmiyor</option>
        </select>
      </div>

      <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5">
        <button type="submit" className="button button-gold px-5 py-2.5 text-sm" disabled={pending}>
          {pending ? 'Filtreleniyor…' : 'Filtrele'}
        </button>
        <Link href="/admin/organizations" className="button px-5 py-2.5 text-sm">
          Temizle
        </Link>
      </div>
    </form>
  );
}
