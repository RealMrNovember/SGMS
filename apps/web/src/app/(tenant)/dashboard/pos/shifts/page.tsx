import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import type { ShiftReportSnapshot } from '@/lib/cash-register/report';
import { decimalToNumber } from '@/lib/member-balance';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

function parseReportSnapshot(value: unknown): ShiftReportSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  return value as ShiftReportSnapshot;
}

export default async function CashShiftsArchivePage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz25');
  const tPos = await getTranslations('pos.cashShift');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);
  const currency = 'TRY';

  const formatter = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  const shifts = await prisma.cashRegisterShift.findMany({
    where: { organizationId, closedAt: { not: null } },
    orderBy: { closedAt: 'desc' },
    take: 100,
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/pos" className="muted text-sm hover:text-white">
          {t('backToPos')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('archiveTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {shifts.length === 0 ? (
            <p className="muted px-6 py-8 text-center text-sm">{t('empty')}</p>
          ) : (
            shifts.map((shift) => {
              const discrepancy = shift.discrepancy != null ? decimalToNumber(shift.discrepancy) : 0;
              const hasDiscrepancy = Math.abs(discrepancy) > 0.009;
              const report = parseReportSnapshot(shift.reportSnapshot);

              return (
                <article key={shift.id} className="space-y-4 px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {shift.openedAt.toLocaleString(dateLocale)} →{' '}
                        {shift.closedAt?.toLocaleString(dateLocale)}
                      </p>
                      <p className="muted mt-1 text-sm">
                        {t('openedBy')}: {shift.openedBy.name}
                        {shift.closedBy ? ` · ${t('closedBy')}: ${shift.closedBy.name}` : ''}
                      </p>
                    </div>
                    {hasDiscrepancy ? (
                      <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                        {t('discrepancyBadge', { amount: formatter.format(discrepancy) })}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        {t('balanced')}
                      </span>
                    )}
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="muted text-xs">{tPos('openingBalance')}</dt>
                      <dd>{formatter.format(decimalToNumber(shift.openingBalance))}</dd>
                    </div>
                    <div>
                      <dt className="muted text-xs">{tPos('expectedBalance')}</dt>
                      <dd>
                        {shift.closingBalanceExpected != null
                          ? formatter.format(decimalToNumber(shift.closingBalanceExpected))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="muted text-xs">{tPos('countedBalance')}</dt>
                      <dd>
                        {shift.closingBalanceCounted != null
                          ? formatter.format(decimalToNumber(shift.closingBalanceCounted))
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="muted text-xs">{tPos('discrepancy')}</dt>
                      <dd className={hasDiscrepancy ? 'font-semibold text-amber-300' : ''}>
                        {shift.discrepancy != null
                          ? formatter.format(decimalToNumber(shift.discrepancy))
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {shift.notes ? (
                    <p className="muted text-sm">
                      {tPos('notes')}: {shift.notes}
                    </p>
                  ) : null}

                  {report ? (
                    <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4">
                      <p className="text-sm font-medium">{t('zReport')}</p>
                      <table className="mt-3 w-full text-xs">
                        <thead>
                          <tr className="muted border-b border-[var(--border)] text-left">
                            <th className="py-2 pr-2">{tPos('method')}</th>
                            <th className="py-2 pr-2">{tPos('payments')}</th>
                            <th className="py-2 pr-2">{tPos('refunds')}</th>
                            <th className="py-2">{tPos('net')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.byPaymentMethod.map((row) => (
                            <tr key={row.method} className="border-b border-[var(--border)]/50">
                              <td className="py-2 pr-2">{tPos(`methods.${row.method}`)}</td>
                              <td className="py-2 pr-2">
                                {formatter.format(row.paymentsTotal)} ({row.paymentsCount})
                              </td>
                              <td className="py-2 pr-2">
                                {formatter.format(row.refundsTotal)} ({row.refundsCount})
                              </td>
                              <td className="py-2">{formatter.format(row.netTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
