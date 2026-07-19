import { AthletePasswordForm } from '@/components/athlete-password-form';
import { AthleteProfileForm } from '@/components/athlete-profile-form';
import { AvatarUpload } from '@/components/avatar-upload';
import { TenantCardCheckoutButton } from '@/components/athlete/tenant-card-checkout-button';
import { MembershipLifecyclePanel } from '@/components/membership/membership-lifecycle-panel';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { decimalToNumber, getMemberAccountSummary } from '@/lib/member-balance';
import { getActiveTenantCardGateway, getTenantBankTransferInfo } from '@/lib/payments/tenant-gateway';
import { getMemberPaymentPlans } from '@/lib/payment-plans';
import { prisma } from '@/lib/prisma';
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

  const [summary, paymentPlans, profile, activeCardGateway, bankTransferInfo] = await Promise.all([
    getMemberAccountSummary(session.user.organizationId, session.user.gymMemberId),
    getMemberPaymentPlans(session.user.organizationId, session.user.gymMemberId),
    prisma.gymMember.findFirst({
      where: { id: session.user.gymMemberId, organizationId: session.user.organizationId },
      select: {
        phone: true,
        email: true,
        birthDate: true,
        avatarUrl: true,
        status: true,
        firstName: true,
        lastName: true,
        user: { select: { name: true } },
      },
    }),
    getActiveTenantCardGateway(session.user.organizationId),
    getTenantBankTransferInfo(session.user.organizationId),
  ]);

  const openBalance = decimalToNumber(summary.openBalance);
  const balanceEntries = Object.entries(summary.balancesByCurrency).filter(([, v]) => v > 0);
  const activePlans = paymentPlans.filter((plan) => plan.status === 'ACTIVE');

  function money(amount: number, code: string) {
    try {
      return new Intl.NumberFormat(intlLocaleFor(locale), {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${code}`;
    }
  }

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

      <section className="card p-5">
        <h3 className="font-semibold">{tAthlete('profile.avatarTitle')}</h3>
        <div className="mt-3">
          <AvatarUpload
            name={profile?.user?.name ?? tAthlete('pages.account')}
            currentUrl={profile?.avatarUrl}
            targetType="gym_member"
            gymMemberId={session.user.gymMemberId}
            canUpload
            size="lg"
          />
        </div>
      </section>

      <AthleteProfileForm
        name={profile?.user?.name ?? ''}
        phone={profile?.phone ?? null}
        email={profile?.email ?? null}
        birthDate={profile?.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null}
      />

      <AthletePasswordForm />

      {profile && (profile.status === 'ACTIVE' || profile.status === 'FROZEN') ? (
        <MembershipLifecyclePanel
          gymMemberId={session.user.gymMemberId}
          memberName={`${profile.firstName} ${profile.lastName}`}
          memberStatus={profile.status}
          pendingFreezes={[]}
          memberOptions={[]}
          canManage={false}
          isAthleteView
        />
      ) : null}

      <section className="card p-5 text-center">
        <p className="muted text-sm">{t('openBalance')}</p>
        {balanceEntries.length > 1 ? (
          <ul className="mt-2 space-y-1">
            {balanceEntries.map(([code, amount]) => (
              <li key={code} className="text-2xl font-semibold text-amber-200">
                {money(amount, code)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-3xl font-semibold text-amber-200">
            {balanceEntries.length === 1
              ? money(balanceEntries[0]![1], balanceEntries[0]![0])
              : formatter.format(openBalance)}
          </p>
        )}
        {balanceEntries.length === 0 ? (
          <p className="muted mt-3 text-sm">{t('noDebt')}</p>
        ) : (
          <>
            <p className="muted mt-3 text-sm">{t('payAtDesk')}</p>
            {activeCardGateway ? (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {balanceEntries.map(([code]) => (
                  <TenantCardCheckoutButton key={code} currency={code} />
                ))}
              </div>
            ) : null}
            {bankTransferInfo ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/5 p-4 text-left text-sm">
                <p className="font-medium">{t('bankTransferTitle')}</p>
                {bankTransferInfo.ibanHolderName ? (
                  <p className="muted mt-1">
                    {t('bankTransferAccountHolder')}: {bankTransferInfo.ibanHolderName}
                  </p>
                ) : null}
                {bankTransferInfo.ibanNumber ? (
                  <p className="muted">{bankTransferInfo.ibanNumber}</p>
                ) : null}
                {bankTransferInfo.ibanBankName ? (
                  <p className="muted">
                    {t('bankTransferBank')}: {bankTransferInfo.ibanBankName}
                  </p>
                ) : null}
                {bankTransferInfo.bankTransferNote ? (
                  <p className="muted mt-1 text-xs">{bankTransferInfo.bankTransferNote}</p>
                ) : null}
              </div>
            ) : null}
          </>
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
