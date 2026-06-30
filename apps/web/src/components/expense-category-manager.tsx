'use client';

import {
  saveExpenseCategory,
  setExpenseCategoryActive,
  type ExpenseActionState,
} from '@/actions/expenses';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';

type CategoryRow = {
  id: string;
  name: string;
  defaultAmount: string | null;
  sortOrder: number;
  isActive: boolean;
};

const initialState: ExpenseActionState = {};

export function ExpenseCategoryManager({
  categories,
  currency,
}: {
  categories: CategoryRow[];
  currency: string;
}) {
  const t = useTranslations('pos');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveExpenseCategory, initialState);
  const [togglePending, startToggle] = useTransition();

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  return (
    <section className="card space-y-5 p-6">
      <div>
        <h3 className="text-lg font-semibold">{t('categoriesTitle')}</h3>
        <p className="muted mt-1 text-sm">{t('categoriesSubtitle')}</p>
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

      <form action={formAction} className="grid gap-3 md:grid-cols-4">
        <input name="name" required placeholder={t('categoryName')} className="input md:col-span-2" />
        <input
          name="defaultAmount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder={t('categoryAmount')}
          className="input"
        />
        <input
          name="sortOrder"
          type="number"
          min="0"
          defaultValue={categories.length + 1}
          placeholder={t('categorySort')}
          className="input"
        />
        <button type="submit" disabled={pending} className="button px-4 py-2 text-sm md:col-span-4">
          {pending ? tCommon('ellipsis') : t('addCategory')}
        </button>
      </form>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {categories.length === 0 ? (
          <p className="muted px-4 py-4 text-sm">{t('noCategories')}</p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {category.name}{' '}
                  {!category.isActive ? (
                    <span className="badge text-[10px] opacity-70">{t('inactive')}</span>
                  ) : null}
                </p>
                <p className="muted text-xs">
                  {category.defaultAmount != null
                    ? formatter.format(Number(category.defaultAmount))
                    : t('noDefaultAmount')}{' '}
                  · #{category.sortOrder}
                </p>
              </div>
              <button
                type="button"
                disabled={togglePending}
                className="button px-3 py-1.5 text-xs"
                onClick={() => {
                  startToggle(async () => {
                    await setExpenseCategoryActive(category.id, !category.isActive);
                    router.refresh();
                  });
                }}
              >
                {category.isActive ? t('deactivate') : t('activate')}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
