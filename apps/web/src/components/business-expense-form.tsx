'use client';

import { createBusinessExpense, type BusinessExpenseState } from '@/actions/business-expenses';
import { useActionState } from 'react';

const initial: BusinessExpenseState = {};

export function BusinessExpenseForm() {
  const [state, action, pending] = useActionState(createBusinessExpense, initial);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h3 className="font-semibold">İşletme gideri ekle</h3>
        <p className="muted mt-1 text-sm">
          Kira, fatura, maaş vb. — üye cari hesabından ayrıdır. Net kâr hesabında kullanılır.
        </p>
      </div>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="muted text-sm">Kategori</label>
          <select name="category" className="input" defaultValue="OTHER" required>
            <option value="RENT">Kira</option>
            <option value="UTILITIES">Faturalar</option>
            <option value="SALARY">Maaş</option>
            <option value="SUPPLIES">Sarf / stok</option>
            <option value="MARKETING">Pazarlama</option>
            <option value="OTHER">Diğer</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">Tutar (TRY)</label>
          <input type="number" name="amount" className="input" min={0.01} step="0.01" required />
        </div>
        <div className="space-y-2">
          <label className="muted text-sm">Tarih</label>
          <input type="date" name="incurredAt" className="input" defaultValue={today} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="muted text-sm">Açıklama</label>
          <input type="text" name="description" className="input" maxLength={500} />
        </div>
        <button type="submit" className="button md:col-span-2" disabled={pending}>
          Gideri kaydet
        </button>
      </form>
    </section>
  );
}
