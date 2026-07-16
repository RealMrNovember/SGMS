import { PaymentPlanPayButton } from '@/components/payment-plan-pay-button';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { getOrganizationPaymentPlansOverview } from '@/lib/payment-plans';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const PAYMENT_PLANS_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);

export default async function PaymentPlansPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !PAYMENT_PLANS_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('paymentPlans');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const installments = await getOrganizationPaymentPlansOverview(organizationId);

  const currency = 'TRY';
  const formatter = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 text-sm">{t('subtitle')}</p>
      </div>

      <div className="card overflow-hidden">
        {installments.length === 0 ? (
          <p className="muted px-6 py-8 text-center text-sm">{t('empty')}</p>
        ) : (
          <>
            <div className="data-card-list p-4 md:hidden">
              {installments.map((installment) => {
                const outstanding = installment.amount - installment.paidAmount;
                const isOverdue = installment.dueDate != null && new Date(installment.dueDate).getTime() < now;
                return (
                  <div key={installment.id} className="data-card">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/dashboard/members/${installment.gymMemberId}`}
                        className="font-medium hover:text-white"
                      >
                        {installment.memberName}
                      </Link>
                      {isOverdue ? (
                        <span className="badge border-rose-500/40 text-[10px] text-rose-200">
                          {t('overdue')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <div className="data-card-row">
                        <span className="data-card-label">{t('columns.dueDate')}</span>
                        <span className="data-card-value">
                          {installment.dueDate ? new Date(installment.dueDate).toLocaleDateString(dateLocale) : '—'}
                        </span>
                      </div>
                      <div className="data-card-row">
                        <span className="data-card-label">{t('columns.amount')}</span>
                        <span className="data-card-value">
                          {formatter.format(installment.paidAmount)} / {formatter.format(installment.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="data-card-actions">
                      <PaymentPlanPayButton
                        gymMemberId={installment.gymMemberId}
                        expenseId={installment.id}
                        outstanding={outstanding}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 font-medium">{t('columns.member')}</th>
                    <th className="px-6 py-3 font-medium">{t('columns.dueDate')}</th>
                    <th className="px-6 py-3 font-medium">{t('columns.amount')}</th>
                    <th className="px-6 py-3 font-medium">{t('columns.status')}</th>
                    <th className="px-6 py-3 font-medium">{t('columns.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((installment) => {
                    const outstanding = installment.amount - installment.paidAmount;
                    const isOverdue =
                      installment.dueDate != null && new Date(installment.dueDate).getTime() < now;
                    return (
                      <tr key={installment.id} className="border-b border-[var(--border)] last:border-none">
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/members/${installment.gymMemberId}`}
                            className="font-medium hover:text-white"
                          >
                            {installment.memberName}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {installment.dueDate
                            ? new Date(installment.dueDate).toLocaleDateString(dateLocale)
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          {formatter.format(installment.paidAmount)} / {formatter.format(installment.amount)}
                        </td>
                        <td className="px-6 py-4">
                          {isOverdue ? (
                            <span className="badge border-rose-500/40 text-[10px] text-rose-200">
                              {t('overdue')}
                            </span>
                          ) : (
                            <span className="badge text-[10px]">{t('upcoming')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <PaymentPlanPayButton
                            gymMemberId={installment.gymMemberId}
                            expenseId={installment.id}
                            outstanding={outstanding}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
