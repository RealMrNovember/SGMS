'use client';

import {
  addMemberExpense,
  quickAddCategoryExpense,
  recordPayment,
  type ExpenseActionState,
} from '@/actions/expenses';
import { voidExpense } from '@/actions/expenses';
import {
  createPaymentPlan,
  cancelPaymentPlan,
  type PaymentPlanActionState,
} from '@/actions/payment-plans';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';

type Category = {
  id: string;
  name: string;
  defaultAmount: string | null;
};

type PaymentPlanInstallment = {
  id: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string | null;
  description: string | null;
};

type MemberPaymentPlan = {
  id: string;
  description: string | null;
  installmentCount: number;
  status: string;
  installments: PaymentPlanInstallment[];
};

const initialState: ExpenseActionState = {};
const initialPlanState: PaymentPlanActionState = {};

export function MemberAccountPanel({
  gymMemberId,
  canManage,
  canVoid,
  categories,
  openBalance,
  currency,
  expenses,
  transactions,
  paymentPlans,
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
  paymentPlans: MemberPaymentPlan[];
}) {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState(addMemberExpense, initialState);
  const [payState, payAction, payPending] = useActionState(recordPayment, initialState);
  const [planState, planAction, planPending] = useActionState(createPaymentPlan, initialPlanState);
  const [quickPending, startQuick] = useTransition();
  const [voidPending, startVoid] = useTransition();
  const [cancelPlanPending, startCancelPlan] = useTransition();

  const now = Date.now();

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

      <div className="space-y-4 border-t border-[var(--border)] pt-6">
        <div>
          <h4 className="font-medium">{t('paymentPlan.title')}</h4>
          <p className="muted mt-1 text-sm">{t('paymentPlan.subtitle')}</p>
        </div>

        {paymentPlans.length === 0 ? (
          <p className="muted text-sm">{t('paymentPlan.empty')}</p>
        ) : (
          <div className="space-y-4">
            {paymentPlans.map((plan) => (
              <div key={plan.id} className="data-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {plan.description ?? t('paymentPlan.title')}{' '}
                      <span className="badge text-[10px]">
                        {t(`paymentPlan.planStatus.${plan.status}`)}
                      </span>
                    </p>
                    <p className="muted text-xs">
                      {t('paymentPlan.installmentCountLabel', { count: plan.installmentCount })}
                    </p>
                  </div>
                  {canVoid && plan.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      disabled={cancelPlanPending}
                      className="text-xs text-rose-300 hover:text-rose-200"
                      onClick={() => {
                        startCancelPlan(async () => {
                          await cancelPaymentPlan(plan.id);
                          router.refresh();
                        });
                      }}
                    >
                      {t('paymentPlan.cancelPlan')}
                    </button>
                  ) : null}
                </div>

                <div className="data-card-list mt-3">
                  {plan.installments.map((installment, index) => {
                    const outstanding = installment.amount - installment.paidAmount;
                    const isOverdue =
                      installment.status === 'OPEN' &&
                      installment.dueDate != null &&
                      new Date(installment.dueDate).getTime() < now;

                    return (
                      <div key={installment.id} className="data-card-row flex-col items-stretch gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="data-card-label">
                            {t('paymentPlan.installmentLabel', {
                              index: index + 1,
                              count: plan.installmentCount,
                            })}
                          </span>
                          <span
                            className={`badge text-[10px] ${isOverdue ? 'border-rose-500/40 text-rose-200' : ''}`}
                          >
                            {isOverdue
                              ? t('paymentPlan.status.OVERDUE')
                              : t(`paymentPlan.status.${installment.status}`)}
                          </span>
                        </div>
                        <div className="data-card-value flex flex-wrap items-center justify-between gap-2 text-left">
                          <span className="muted text-xs">
                            {installment.dueDate
                              ? new Date(installment.dueDate).toLocaleDateString()
                              : '—'}
                          </span>
                          <span>
                            {formatter.format(installment.paidAmount)} / {formatter.format(installment.amount)}
                          </span>
                        </div>
                        {canManage && installment.status === 'OPEN' && outstanding > 0 ? (
                          <form action={payAction} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="gymMemberId" value={gymMemberId} />
                            <input type="hidden" name="expenseId" value={installment.id} />
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={outstanding}
                              defaultValue={outstanding}
                              required
                              className="input w-28 text-sm"
                            />
                            <select name="paymentMethod" className="input w-auto text-sm" defaultValue="CASH">
                              <option value="CASH">{t('methods.cash')}</option>
                              <option value="CARD">{t('methods.card')}</option>
                              <option value="TRANSFER">{t('methods.transfer')}</option>
                            </select>
                            <button
                              type="submit"
                              disabled={payPending}
                              className="button px-3 py-1.5 text-xs"
                            >
                              {t('paymentPlan.pay')}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManage ? (
          <>
            {planState.error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {planState.error}
              </p>
            ) : null}
            {planState.success ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {planState.success}
              </p>
            ) : null}

            <form action={planAction} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="gymMemberId" value={gymMemberId} />
              <input
                name="totalAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder={t('paymentPlan.totalAmount')}
                className="input"
              />
              <input
                name="installmentCount"
                type="number"
                step="1"
                min="1"
                max="24"
                required
                placeholder={t('paymentPlan.installmentCount')}
                className="input"
              />
              <input name="firstDueDate" type="date" required className="input" />
              <select name="cadence" className="input" defaultValue="MONTHLY">
                <option value="WEEKLY">{t('paymentPlan.cadenceWeekly')}</option>
                <option value="MONTHLY">{t('paymentPlan.cadenceMonthly')}</option>
                <option value="CUSTOM_DAYS">{t('paymentPlan.cadenceCustom')}</option>
              </select>
              <input
                name="intervalDays"
                type="number"
                step="1"
                min="1"
                max="90"
                placeholder={t('paymentPlan.intervalDays')}
                className="input"
              />
              <input
                name="description"
                placeholder={t('paymentPlan.description')}
                className="input"
              />
              <button
                type="submit"
                disabled={planPending}
                className="button px-4 py-2 text-sm md:col-span-3"
              >
                {planPending ? tCommon('ellipsis') : t('paymentPlan.create')}
              </button>
            </form>
          </>
        ) : null}
      </div>

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
