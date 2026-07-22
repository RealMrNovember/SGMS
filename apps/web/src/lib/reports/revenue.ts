import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

export type DateRange = { start: Date; end: Date };

export type CurrencyRevenue = {
  currency: string;
  /** Tahsil edilen net = PAYMENT − REFUND */
  collected: number;
  payments: number;
  refunds: number;
  /** Dönemde oluşturulan faturalanan (VOID hariç Expense.amount) */
  billed: number;
};

export type RevenueForPeriod = {
  /** Varsayılan gösterim para birimi (TRY tercih, yoksa ilk) */
  primaryCurrency: string;
  /** primaryCurrency için net tahsilat (geriye dönük KPI uyumu) */
  collected: number;
  payments: number;
  refunds: number;
  billed: number;
  byCurrency: CurrencyRevenue[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Tek doğru ciro kaynağı (36.10): tahsil edilen = PAYMENT − REFUND;
 * faturalanan = Expense (VOID değil) ayrı etiketlenir.
 */
export async function getRevenueForPeriod(
  organizationId: string | string[],
  range: DateRange,
): Promise<RevenueForPeriod> {
  const organizationIds = Array.isArray(organizationId) ? organizationId : [organizationId];

  const [paymentGroups, refundGroups, expenseGroups] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        organizationId: { in: organizationIds },
        type: 'PAYMENT',
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        organizationId: { in: organizationIds },
        type: 'REFUND',
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['currency'],
      where: {
        organizationId: { in: organizationIds },
        status: { not: 'VOID' },
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
  ]);

  const currencies = new Set<string>();
  for (const row of [...paymentGroups, ...refundGroups, ...expenseGroups]) {
    currencies.add((row.currency || 'TRY').toUpperCase());
  }
  if (currencies.size === 0) {
    currencies.add('TRY');
  }

  const paymentsMap = new Map(
    paymentGroups.map((r) => [(r.currency || 'TRY').toUpperCase(), decimalToNumber(r._sum.amount)]),
  );
  const refundsMap = new Map(
    refundGroups.map((r) => [(r.currency || 'TRY').toUpperCase(), decimalToNumber(r._sum.amount)]),
  );
  const billedMap = new Map(
    expenseGroups.map((r) => [(r.currency || 'TRY').toUpperCase(), decimalToNumber(r._sum.amount)]),
  );

  const byCurrency: CurrencyRevenue[] = Array.from(currencies)
    .sort((a, b) => (a === 'TRY' ? -1 : b === 'TRY' ? 1 : a.localeCompare(b)))
    .map((currency) => {
      const payments = paymentsMap.get(currency) ?? 0;
      const refunds = refundsMap.get(currency) ?? 0;
      return {
        currency,
        payments: round2(payments),
        refunds: round2(refunds),
        collected: round2(payments - refunds),
        billed: round2(billedMap.get(currency) ?? 0),
      };
    });

  const primary =
    byCurrency.find((c) => c.currency === 'TRY') ?? byCurrency[0] ?? {
      currency: 'TRY',
      collected: 0,
      payments: 0,
      refunds: 0,
      billed: 0,
    };

  return {
    primaryCurrency: primary.currency,
    collected: primary.collected,
    payments: primary.payments,
    refunds: primary.refunds,
    billed: primary.billed,
    byCurrency,
  };
}

/** Kurumsal konsolidasyon: şube bazında net tahsilat (PAYMENT − REFUND).
 *  Farklı para birimleri toplanmaz — her şube için birincil (TRY tercih) tutar döner.
 */
export async function getCollectedRevenueByOrganization(
  organizationIds: string[],
  range: DateRange,
): Promise<Map<string, number>> {
  if (organizationIds.length === 0) {
    return new Map();
  }

  const [payments, refunds] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['organizationId', 'currency'],
      where: {
        organizationId: { in: organizationIds },
        type: 'PAYMENT',
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['organizationId', 'currency'],
      where: {
        organizationId: { in: organizationIds },
        type: 'REFUND',
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    }),
  ]);

  const byOrgCurrency = new Map<string, Map<string, number>>();
  for (const id of organizationIds) {
    byOrgCurrency.set(id, new Map());
  }

  for (const row of payments) {
    const currency = (row.currency || 'TRY').toUpperCase();
    const orgMap = byOrgCurrency.get(row.organizationId) ?? new Map();
    orgMap.set(currency, decimalToNumber(row._sum.amount));
    byOrgCurrency.set(row.organizationId, orgMap);
  }
  for (const row of refunds) {
    const currency = (row.currency || 'TRY').toUpperCase();
    const orgMap = byOrgCurrency.get(row.organizationId) ?? new Map();
    orgMap.set(currency, round2((orgMap.get(currency) ?? 0) - decimalToNumber(row._sum.amount)));
    byOrgCurrency.set(row.organizationId, orgMap);
  }

  const map = new Map<string, number>();
  for (const id of organizationIds) {
    const orgMap = byOrgCurrency.get(id) ?? new Map();
    const primary =
      orgMap.has('TRY') ? 'TRY' : [...orgMap.keys()].sort((a, b) => a.localeCompare(b))[0];
    map.set(id, primary ? (orgMap.get(primary) ?? 0) : 0);
  }
  return map;
}
