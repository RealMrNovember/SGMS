import { decimalToNumber } from '@/lib/member-balance';
import type { PaymentMethod, Prisma } from '@sgms/database';

export type ShiftReportByMethod = {
  method: PaymentMethod;
  paymentsTotal: number;
  paymentsCount: number;
  refundsTotal: number;
  refundsCount: number;
  netTotal: number;
};

export type ShiftReportSnapshot = {
  generatedAt: string;
  openingBalance: number;
  closingBalanceExpected?: number;
  closingBalanceCounted?: number;
  discrepancy?: number;
  cashPaymentsTotal: number;
  cashRefundsTotal: number;
  transactionCount: number;
  byPaymentMethod: ShiftReportByMethod[];
};

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER'];

type ShiftTransactionRow = {
  amount: Prisma.Decimal;
  type: 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'CHARGE';
  paymentMethod: PaymentMethod;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildShiftReportSnapshot(
  openingBalance: number,
  transactions: ShiftTransactionRow[],
  extras?: {
    closingBalanceExpected?: number;
    closingBalanceCounted?: number;
    discrepancy?: number;
  },
): ShiftReportSnapshot {
  const byMethod = new Map<
    PaymentMethod,
    { paymentsTotal: number; paymentsCount: number; refundsTotal: number; refundsCount: number }
  >();

  for (const method of PAYMENT_METHODS) {
    byMethod.set(method, {
      paymentsTotal: 0,
      paymentsCount: 0,
      refundsTotal: 0,
      refundsCount: 0,
    });
  }

  let cashPaymentsTotal = 0;
  let cashRefundsTotal = 0;

  for (const tx of transactions) {
    const amount = decimalToNumber(tx.amount);
    const bucket = byMethod.get(tx.paymentMethod)!;

    if (tx.type === 'PAYMENT') {
      bucket.paymentsTotal += amount;
      bucket.paymentsCount += 1;
      if (tx.paymentMethod === 'CASH') {
        cashPaymentsTotal += amount;
      }
    } else if (tx.type === 'REFUND') {
      bucket.refundsTotal += amount;
      bucket.refundsCount += 1;
      if (tx.paymentMethod === 'CASH') {
        cashRefundsTotal += amount;
      }
    }
  }

  const closingBalanceExpected =
    extras?.closingBalanceExpected ??
    roundMoney(openingBalance + cashPaymentsTotal - cashRefundsTotal);

  return {
    generatedAt: new Date().toISOString(),
    openingBalance: roundMoney(openingBalance),
    closingBalanceExpected,
    closingBalanceCounted: extras?.closingBalanceCounted,
    discrepancy: extras?.discrepancy,
    cashPaymentsTotal: roundMoney(cashPaymentsTotal),
    cashRefundsTotal: roundMoney(cashRefundsTotal),
    transactionCount: transactions.length,
    byPaymentMethod: PAYMENT_METHODS.map((method) => {
      const row = byMethod.get(method)!;
      return {
        method,
        paymentsTotal: roundMoney(row.paymentsTotal),
        paymentsCount: row.paymentsCount,
        refundsTotal: roundMoney(row.refundsTotal),
        refundsCount: row.refundsCount,
        netTotal: roundMoney(row.paymentsTotal - row.refundsTotal),
      };
    }),
  };
}
