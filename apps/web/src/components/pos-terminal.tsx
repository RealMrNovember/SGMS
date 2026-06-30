'use client';

import {
  addMemberExpense,
  getMemberPosSnapshot,
  quickAddCategoryExpense,
  recordPayment,
  type ExpenseActionState,
} from '@/actions/expenses';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState, useTransition } from 'react';

type MemberOption = {
  id: string;
  label: string;
};

type CategoryOption = {
  id: string;
  name: string;
  defaultAmount: string | null;
};

const initialState: ExpenseActionState = {};

export function PosTerminal({
  members,
  categories,
  currency,
}: {
  members: MemberOption[];
  categories: CategoryOption[];
  currency: string;
}) {
  const t = useTranslations('pos');
  const tExpenses = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [openBalance, setOpenBalance] = useState<number | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<
    Array<{
      id: string;
      description: string | null;
      amount: string;
      status: string;
      category: { name: string } | null;
    }>
  >([]);
  const [snapshotPending, startSnapshot] = useTransition();
  const [quickPending, startQuick] = useTransition();

  const [addState, addAction, addPending] = useActionState(addMemberExpense, initialState);
  const [payState, payAction, payPending] = useActionState(recordPayment, initialState);

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  useEffect(() => {
    if (!selectedMemberId) {
      setOpenBalance(null);
      setRecentExpenses([]);
      return;
    }

    startSnapshot(async () => {
      const result = await getMemberPosSnapshot(selectedMemberId);
      if ('error' in result) {
        setOpenBalance(null);
        setRecentExpenses([]);
        return;
      }
      setOpenBalance(result.openBalance);
      setRecentExpenses(result.recentExpenses);
    });
  }, [selectedMemberId, addState.success, payState.success, quickPending]);

  const memberSelected = Boolean(selectedMemberId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="card space-y-5 p-6">
        <div>
          <h3 className="text-lg font-semibold">{t('terminalTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('terminalSubtitle')}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="pos-member" className="muted text-sm">
            {t('selectMember')}
          </label>
          <select
            id="pos-member"
            className="input w-full"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
          >
            <option value="">{t('selectMemberPlaceholder')}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </div>

        {memberSelected ? (
          <div className="rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3">
            <p className="muted text-xs">{tExpenses('openBalance')}</p>
            <p className="text-2xl font-semibold text-amber-200">
              {snapshotPending ? tCommon('ellipsis') : formatter.format(openBalance ?? 0)}
            </p>
          </div>
        ) : (
          <p className="muted text-sm">{t('selectMemberHint')}</p>
        )}

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

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              disabled={!memberSelected || quickPending || category.defaultAmount == null}
              className="button px-3 py-2 text-sm"
              onClick={() => {
                startQuick(async () => {
                  await quickAddCategoryExpense(selectedMemberId, category.id);
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

        <form action={addAction} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="gymMemberId" value={selectedMemberId} />
          <input type="hidden" name="currency" value={currency} />
          <input
            name="description"
            placeholder={tExpenses('customDescription')}
            className="input sm:col-span-2"
            disabled={!memberSelected}
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder={tExpenses('amount')}
            className="input"
            disabled={!memberSelected}
          />
          <button
            type="submit"
            disabled={!memberSelected || addPending}
            className="button px-4 py-2 text-sm sm:col-span-3"
          >
            {addPending ? tCommon('ellipsis') : tExpenses('addExpense')}
          </button>
        </form>

        <form action={payAction} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="gymMemberId" value={selectedMemberId} />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder={tExpenses('paymentAmount')}
            className="input"
            disabled={!memberSelected}
          />
          <select name="paymentMethod" className="input" defaultValue="CASH" disabled={!memberSelected}>
            <option value="CASH">{tExpenses('methods.cash')}</option>
            <option value="CARD">{tExpenses('methods.card')}</option>
            <option value="TRANSFER">{tExpenses('methods.transfer')}</option>
          </select>
          <input
            name="notes"
            placeholder={tExpenses('paymentNotes')}
            className="input sm:col-span-2"
            disabled={!memberSelected}
          />
          <button
            type="submit"
            disabled={!memberSelected || payPending}
            className="button px-4 py-2 text-sm sm:col-span-4"
          >
            {payPending ? tCommon('ellipsis') : tExpenses('recordPayment')}
          </button>
        </form>
      </section>

      <section className="card p-6">
        <h3 className="text-lg font-semibold">{t('recentActivity')}</h3>
        <p className="muted mt-1 text-sm">{t('recentActivityHint')}</p>
        {!memberSelected ? (
          <p className="muted mt-4 text-sm">{t('selectMemberHint')}</p>
        ) : snapshotPending ? (
          <p className="muted mt-4 text-sm">{tCommon('ellipsis')}</p>
        ) : (
          <ul className="muted mt-4 space-y-2 text-sm">
            {recentExpenses.length === 0 ? (
              <li>{tExpenses('emptyExpenses')}</li>
            ) : (
              recentExpenses.map((expense) => (
                <li key={expense.id} className="flex justify-between gap-3 border-b border-[var(--border)] pb-2">
                  <span>
                    {expense.description ?? expense.category?.name ?? '—'}{' '}
                    <span className="badge text-[10px]">{expense.status}</span>
                  </span>
                  <span className="text-white">{formatter.format(Number(expense.amount))}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
