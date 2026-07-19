'use client';

import {
  buildXReport,
  closeCashShift,
  openCashShift,
  type CashRegisterActionState,
  type ShiftReportSnapshot,
} from '@/actions/cash-register';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState, useTransition } from 'react';

type OpenShiftInfo = {
  id: string;
  openedAt: string;
  openingBalance: string;
  openedByName: string;
};

const initialState: CashRegisterActionState = {};

function ShiftReportView({
  report,
  currency,
}: {
  report: ShiftReportSnapshot;
  currency: string;
}) {
  const t = useTranslations('pos.cashShift');
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-[var(--border)] bg-black/20 p-4 text-sm">
      <p className="font-medium">{t('reportTitle')}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="muted text-xs">{t('openingBalance')}</dt>
          <dd>{formatter.format(report.openingBalance)}</dd>
        </div>
        <div>
          <dt className="muted text-xs">{t('expectedBalance')}</dt>
          <dd>{formatter.format(report.closingBalanceExpected ?? 0)}</dd>
        </div>
        {report.closingBalanceCounted != null ? (
          <div>
            <dt className="muted text-xs">{t('countedBalance')}</dt>
            <dd>{formatter.format(report.closingBalanceCounted)}</dd>
          </div>
        ) : null}
        {report.discrepancy != null ? (
          <div>
            <dt className="muted text-xs">{t('discrepancy')}</dt>
            <dd
              className={
                Math.abs(report.discrepancy) > 0.009 ? 'font-semibold text-amber-300' : ''
              }
            >
              {formatter.format(report.discrepancy)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="muted text-xs">{t('cashIn')}</dt>
          <dd className="text-emerald-200">{formatter.format(report.cashPaymentsTotal)}</dd>
        </div>
        <div>
          <dt className="muted text-xs">{t('cashOut')}</dt>
          <dd className="text-rose-200">{formatter.format(report.cashRefundsTotal)}</dd>
        </div>
      </dl>
      <table className="w-full text-xs">
        <thead>
          <tr className="muted border-b border-[var(--border)] text-left">
            <th className="py-2 pr-2">{t('method')}</th>
            <th className="py-2 pr-2">{t('payments')}</th>
            <th className="py-2 pr-2">{t('refunds')}</th>
            <th className="py-2">{t('net')}</th>
          </tr>
        </thead>
        <tbody>
          {report.byPaymentMethod.map((row) => (
            <tr key={row.method} className="border-b border-[var(--border)]/50">
              <td className="py-2 pr-2">{t(`methods.${row.method}`)}</td>
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
  );
}

export function CashShiftPanel({
  openShift,
  currency,
}: {
  openShift: OpenShiftInfo | null;
  currency: string;
}) {
  const t = useTranslations('pos.cashShift');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [openState, openAction, openPending] = useActionState(openCashShift, initialState);
  const [closeState, closeAction, closePending] = useActionState(closeCashShift, initialState);
  const [xReport, setXReport] = useState<ShiftReportSnapshot | null>(null);
  const [xError, setXError] = useState<string | null>(null);
  const [xPending, startXReport] = useTransition();

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  useEffect(() => {
    if (openState.success || closeState.success) {
      router.refresh();
    }
  }, [openState.success, closeState.success, router]);

  useEffect(() => {
    if (closeState.report) {
      setXReport(closeState.report);
    }
  }, [closeState.report]);

  const activeReport = xReport ?? closeState.report ?? null;
  const error = openState.error ?? closeState.error ?? xError;
  const success = openState.success ?? closeState.success;

  return (
    <section className="card space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="muted mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <Link href="/dashboard/pos/shifts" className="button button-ghost text-sm">
          {t('viewArchive')}
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      {openShift ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-200">{t('shiftOpen')}</p>
          <dl className="muted mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs">{t('openedAt')}</dt>
              <dd className="text-white">
                {new Date(openShift.openedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs">{t('openedBy')}</dt>
              <dd className="text-white">{openShift.openedByName}</dd>
            </div>
            <div>
              <dt className="text-xs">{t('openingBalance')}</dt>
              <dd className="text-white">{formatter.format(Number(openShift.openingBalance))}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="button button-ghost"
              disabled={xPending}
              onClick={() => {
                setXError(null);
                startXReport(async () => {
                  const result = await buildXReport(openShift.id);
                  if (result.error) {
                    setXError(result.error);
                    setXReport(null);
                    return;
                  }
                  setXReport(result.report ?? null);
                });
              }}
            >
              {xPending ? tCommon('ellipsis') : t('xReport')}
            </button>
          </div>

          <form action={closeAction} className="mt-4 grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="muted text-sm" htmlFor="closingBalanceCounted">
                {t('countedBalance')}
              </label>
              <input
                id="closingBalanceCounted"
                name="closingBalanceCounted"
                type="number"
                step="0.01"
                min="0"
                className="input"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="muted text-sm" htmlFor="closeNotes">
                {t('notes')}
              </label>
              <textarea id="closeNotes" name="notes" className="input min-h-[72px]" rows={2} />
            </div>
            <button type="submit" className="button md:col-span-2" disabled={closePending}>
              {closePending ? tCommon('ellipsis') : t('closeShift')}
            </button>
          </form>
        </div>
      ) : (
        <form action={openAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="muted text-sm" htmlFor="openingBalance">
              {t('openingBalance')}
            </label>
            <input
              id="openingBalance"
              name="openingBalance"
              type="number"
              step="0.01"
              min="0"
              className="input"
              defaultValue="0"
              required
            />
          </div>
          <p className="muted text-sm md:col-span-2">{t('openHint')}</p>
          <button type="submit" className="button md:col-span-2" disabled={openPending}>
            {openPending ? tCommon('ellipsis') : t('openShift')}
          </button>
        </form>
      )}

      {activeReport ? <ShiftReportView report={activeReport} currency={currency} /> : null}
    </section>
  );
}
