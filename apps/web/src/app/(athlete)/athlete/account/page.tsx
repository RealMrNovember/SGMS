import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { decimalToNumber, getMemberAccountSummary } from '@/lib/member-balance';
import { getMemberPaymentPlans } from '@/lib/payment-plans';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AthleteAccountPage() {
  const session = await auth();
  if (!session?.user?.gymMemberId || !session.user.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('expenses');
  const tAthlete = await getTranslations('athlete');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [summary, paymentPlans] = await Promise.all([
    getMemberAccountSummary(session.user.organizationId, session.user.gymMemberId),
    getMemberPaymentPlans(session.user.organizationId, session.user.gymMemberId),
  ]);

  const openBalance = decimalToNumber(summary.openBalance);
  const activePlans = paymentPlans.filter((plan) => plan.status === 'ACTIVE');
  const formatter = new Intl.NumberFormat(intlLocaleFor(locale), {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/athlete" className="muted text-sm hover:text-white">
          {tAthlete('backHome')}
        </Link>
        <h2 className="mt-3 text-xl font-semibold">{tAthlete('pages.account')}</h2>
      </div>

      <section className="card p-5 text-center">
        <p className="muted text-sm">{t('openBalance')}</p>
        <p className="mt-2 text-3xl font-semibold text-amber-200">{formatter.format(openBalance)}</p>
        {openBalance === 0 ? (
          <p className="muted mt-3 text-sm">{t('noDebt')}</p>
        ) : (
          <p className="muted mt-3 text-sm">{t('payAtDesk')}</p>
        )}
        <div className="muted mt-4 flex flex-wrap justify-center gap-4 text-sm">
          <a
            href={`/api/v1/members/${session.user.gymMemberId}/statement?format=pdf`}
            className="hover:text-white"
          >
            {t('exportPdf')}
          </a>
          <a
            href={`/api/v1/members/${session.user.gymMemberId}/statement`}
            className="hover:text-white"
          >
            {t('exportCsv')}
          </a>
        </div>
      </section>

      {activePlans.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h3 className="font-semibold">{t('paymentPlan.title')}</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {activePlans.map((plan) => (
              <div key={plan.id} className="px-5 py-4">
                <p className="muted text-xs">
                  {t('paymentPlan.installmentCountLabel', { count: plan.installmentCount })}
                </p>
                <div className="mt-2 space-y-2">
                  {plan.installments.map((installment, index) => (
                    <div key={installment.id} className="flex items-center justify-between text-sm">
                      <span className="muted">
                        {t('paymentPlan.installmentLabel', {
                          index: index + 1,
                          count: plan.installmentCount,
                        })}{' '}
                        ·{' '}
                        {installment.dueDate
                          ? installment.dueDate.toLocaleDateString(dateLocale)
                          : '—'}
                      </span>
                      <span className="flex items-center gap-2">
                        {formatter.format(installment.paidAmount)} / {formatter.format(installment.amount)}
                        <span className="badge text-[10px]">
                          {t(`paymentPlan.status.${installment.status}`)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('recentExpenses')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {summary.recentExpenses.length === 0 ? (
            <p className="muted px-5 py-4 text-sm">{t('emptyExpenses')}</p>
          ) : (
            summary.recentExpenses.map((expense) => (
              <article key={expense.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">
                    {expense.description ?? expense.category?.name ?? '—'}
                  </p>
                  <p className="muted text-xs">
                    {expense.createdAt.toLocaleDateString(dateLocale)} ·{' '}
                    <span className="badge text-[10px]">{expense.status}</span>
                  </p>
                </div>
                <p className="font-medium">{formatter.format(Number(expense.amount.toString()))}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{t('recentPayments')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {summary.recentTransactions.length === 0 ? (
            <p className="muted px-5 py-4 text-sm">{t('emptyPayments')}</p>
          ) : (
            summary.recentTransactions.map((tx) => (
              <article key={tx.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="muted text-xs">
                    {tx.createdAt.toLocaleDateString(dateLocale)}
                    {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}
                  </p>
                </div>
                <p className="font-medium text-emerald-200">
                  {formatter.format(Number(tx.amount.toString()))}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
