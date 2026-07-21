'use client';

import { markStoreOrderDelivered } from '@/actions/expenses';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

type PendingOrder = {
  id: string;
  description: string | null;
  categoryName: string | null;
  categoryImageUrl: string | null;
  amount: string;
  status: string;
  createdAt: string;
  memberName: string;
};

export function PendingStoreDeliveries({
  orders,
  currency,
}: {
  orders: PendingOrder[];
  currency: string;
}) {
  const t = useTranslations('pos.store');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('pendingDeliveriesTitle')}</h3>
        <p className="muted mt-1 text-sm">{t('pendingDeliveriesSubtitle')}</p>
      </div>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {orders.map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
                {order.categoryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.categoryImageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <p className="font-medium">
                  {order.description ?? order.categoryName ?? 'Ürün'}
                  {order.status === 'PAID' ? (
                    <span className="badge ml-2 text-[10px] opacity-70 text-emerald-200">{t('paid')}</span>
                  ) : (
                    <span className="badge ml-2 text-[10px] opacity-70 text-amber-200">{t('paymentPending')}</span>
                  )}
                </p>
                <p className="muted text-xs">
                  {order.memberName} · {formatter.format(Number(order.amount))} ·{' '}
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              className="button px-3 py-1.5 text-xs"
              onClick={() => {
                startTransition(async () => {
                  await markStoreOrderDelivered(order.id);
                  router.refresh();
                });
              }}
            >
              {t('markDelivered')}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
