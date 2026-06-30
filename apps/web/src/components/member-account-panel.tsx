'use client';

import {
  addMemberExpense,
  quickAddCategoryExpense,
  recordPayment,
  type ExpenseActionState,
} from '@/actions/expenses';
import { voidExpense } from '@/actions/expenses';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';

type Category = {
  id: string;
  name: string;
  defaultAmount: string | null;
};

const initialState: ExpenseActionState = {};

export function MemberAccountPanel({
  gymMemberId,
  canManage,
  canVoid,
  categories,
  openBalance,
  currency,
  expenses,
  transactions,
}: {
  gymMemberId: string;
  canManage: boolean;
  canVoid: boolean;
  categories: Category[];
  openBalance: number;
  currency: string;
  expenses: Array<{
    id: string;
    description: string | null;
    amount: string;
    status: string;
    createdAt: string;
    category: { name: string } | null;
  }>;
  transactions: Array<{
    id: string;
    amount: string;
    type: string;
    paymentMethod: string | null;
    createdAt: string;
  }>;
}) {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState(addMemberExpense, initialState);
  const [payState, payAction, payPending] = useActionState(recordPayment, initialState);
  const [quickPending, startQuick] = useTransition();
  const [voidPending, startVoid] = useTransition();

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  return (
    <section className="card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="muted mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="muted text-xs">{t('openBalance')}</p>
          <p className="text-2xl font-semibold text-amber-200">{formatter.format(openBalance)}</p>
          <div className="muted mt-2 flex flex-wrap justify-end gap-3 text-xs">
            <a
              href={`/api/v1/members/${gymMemberId}/statement?format=pdf`}
              className="hover:text-white"
            >
              {t('exportPdf')}
            </a>
            <a href={`/api/v1/members/${gymMemberId}/statement`} className="hover:text-white">
              {t('exportCsv')}
            </a>
          </div>
        </div>
      </div>

      {canManage ? (
        <>
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  disabled={quickPending || category.defaultAmount == null}
                  className="button px-3 py-2 text-xs"
                  onClick={() => {
                    startQuick(async () => {
                      await quickAddCategoryExpense(gymMemberId, category.id);
                      router.refresh();
                    });
                  }}
                >
                  + {category.name}
                  {category.defaultAmount != null
                    ? ` ${formatter.format(Number(category.defaultAmount))}`
                    : ''}
                </button>
              ))}
            </div>
          ) : null}

          {addState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {addState.error}
            </p>
          ) : null}
          {addState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {addState.success}
            </p>
          ) : null}

          <form action={addAction} className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="gymMemberId" value={gymMemberId} />
            <input type="hidden" name="currency" value={currency} />
            <input
              name="description"
              placeholder={t('customDescription')}
              className="input md:col-span-2"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder={t('amount')}
              className="input"
            />
            <button type="submit" disabled={addPending} className="button px-4 py-2 text-sm">
              {addPending ? tCommon('ellipsis') : t('addExpense')}
            </button>
          </form>

          {payState.error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {payState.error}
            </p>
          ) : null}
          {payState.success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {payState.success}
            </p>
          ) : null}

          <form action={payAction} className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="gymMemberId" value={gymMemberId} />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder={t('paymentAmount')}
              className="input"
            />
            <select name="paymentMethod" className="input" defaultValue="CASH">
              <option value="CASH">{t('methods.cash')}</option>
              <option value="CARD">{t('methods.card')}</option>
              <option value="TRANSFER">{t('methods.transfer')}</option>
            </select>
            <input name="notes" placeholder={t('paymentNotes')} className="input md:col-span-2" />
            <button type="submit" disabled={payPending} className="button px-4 py-2 text-sm">
              {payPending ? tCommon('ellipsis') : t('recordPayment')}
            </button>
          </form>
        </>
      ) : (
        <p className="muted text-sm">{t('noPermission')}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="font-medium">{t('recentExpenses')}</h4>
          <ul className="muted mt-3 space-y-2 text-sm">
            {expenses.length === 0 ? (
              <li>{t('emptyExpenses')}</li>
            ) : (
              expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2"
                >
                  <span>
                    {expense.description ?? expense.category?.name ?? '—'}{' '}
                    <span className="badge text-[10px]">{expense.status}</span>
                  </span>
                  <span className="flex items-center gap-2 text-white">
                    {formatter.format(Number(expense.amount))}
                    {canVoid && expense.status === 'OPEN' ? (
                      <button
                        type="button"
                        disabled={voidPending}
                        className="text-xs text-rose-300 hover:text-rose-200"
                        onClick={() => {
                          startVoid(async () => {
                            await voidExpense(expense.id);
                            router.refresh();
                          });
                        }}
                      >
                        {t('void')}
                      </button>
                    ) : null}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-medium">{t('recentPayments')}</h4>
          <ul className="muted mt-3 space-y-2 text-sm">
            {transactions.length === 0 ? (
              <li>{t('emptyPayments')}</li>
            ) : (
              transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2"
                >
                  <span>
                    {tx.type} · {tx.paymentMethod ?? '—'}
                  </span>
                  <span className="text-emerald-200">
                    {formatter.format(Number(tx.amount))}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
