'use client';

import { restockExpenseCategory } from '@/actions/expenses';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type RestockItem = {
  id: string;
  name: string;
  stockQuantity: number | null;
};

/**
 * Faz 40 — kasiyer/resepsiyon (STAFF dahil) mağazada görünen bir ürünün
 * stoğuna, depoya yeni mal geldiğinde hızlıca ekleme yapabilsin diye. Kategori
 * ekleme/fiyatlama/mağaza görünürlüğü (idari karar) ayrı, OWNER/ADMIN-only
 * `ExpenseCategoryManager` altında kalmaya devam ediyor — burası yalnızca
 * mevcut bir ürünün sayısını artırır.
 */
export function RestockPanel({ items }: { items: RestockItem[] }) {
  const t = useTranslations('pos.store');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (items.length === 0) {
    return null;
  }

  function handleAdd(categoryId: string) {
    const raw = quantities[categoryId];
    const qty = Number(raw);
    if (!raw || !Number.isInteger(qty) || qty <= 0) {
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await restockExpenseCategory(categoryId, qty);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.success ?? null);
        setQuantities((prev) => ({ ...prev, [categoryId]: '' }));
        router.refresh();
      }
    });
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('restockTitle')}</h3>
        <p className="muted mt-1 text-sm">{t('restockSubtitle')}</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="muted text-xs">
                {item.stockQuantity != null ? t('stockLabel', { count: item.stockQuantity }) : t('stockUntracked')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                placeholder={t('restockPlaceholder')}
                className="input w-24 px-3 py-1.5 text-sm"
                value={quantities[item.id] ?? ''}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
              <button
                type="button"
                disabled={pending || !quantities[item.id]}
                className="button px-3 py-1.5 text-xs"
                onClick={() => handleAdd(item.id)}
              >
                {t('restockButton')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
