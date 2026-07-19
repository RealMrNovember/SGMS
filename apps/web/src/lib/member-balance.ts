import { prisma } from '@/lib/prisma';

export function decimalToNumber(value: { toString: () => string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }
  return typeof value === 'number' ? value : Number(value.toString());
}

export type BalancesByCurrency = Record<string, number>;

/** Para birimine göre açık bakiye (amount − paidAmount). Tek sayı yanıltıcı olmasın (36.2). */
export async function getMemberOpenBalancesByCurrency(
  organizationId: string,
  gymMemberId: string,
): Promise<BalancesByCurrency> {
  const openExpenses = await prisma.expense.findMany({
    where: { organizationId, gymMemberId, status: 'OPEN' },
    select: { currency: true, amount: true, paidAmount: true },
  });

  const balances: BalancesByCurrency = {};
  for (const expense of openExpenses) {
    const currency = (expense.currency || 'TRY').toUpperCase();
    const outstanding =
      decimalToNumber(expense.amount) - decimalToNumber(expense.paidAmount);
    if (outstanding <= 0) continue;
    balances[currency] = (balances[currency] ?? 0) + outstanding;
  }

  return balances;
}

/** Geriye dönük: tek sayı — yalnızca verilen (veya tek) para birimi. */
export async function getMemberOpenBalance(
  organizationId: string,
  gymMemberId: string,
  currency = 'TRY',
): Promise<number> {
  const balances = await getMemberOpenBalancesByCurrency(organizationId, gymMemberId);
  const normalized = currency.toUpperCase();
  if (balances[normalized] != null) {
    return Math.round(balances[normalized] * 100) / 100;
  }
  const keys = Object.keys(balances);
  if (keys.length === 1) {
    return Math.round(balances[keys[0]!]! * 100) / 100;
  }
  return Math.round((balances[normalized] ?? 0) * 100) / 100;
}

export async function getMemberOpenCurrencyCodes(
  organizationId: string,
  gymMemberId: string,
): Promise<string[]> {
  const rows = await prisma.expense.findMany({
    where: { organizationId, gymMemberId, status: 'OPEN' },
    select: { currency: true },
    distinct: ['currency'],
  });
  return rows.map((r) => (r.currency || 'TRY').toUpperCase()).sort();
}

export async function getMemberAccountSummary(organizationId: string, gymMemberId: string) {
  const [balancesByCurrency, recentExpenses, recentTransactions] = await Promise.all([
    getMemberOpenBalancesByCurrency(organizationId, gymMemberId),
    prisma.expense.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        createdBy: { select: { id: true, name: true } },
        refunds: { select: { id: true, amount: true } },
      },
    }),
  ]);

  const openBalance =
    Object.keys(balancesByCurrency).length === 1
      ? Object.values(balancesByCurrency)[0]!
      : balancesByCurrency.TRY ?? 0;

  return {
    openBalance,
    balancesByCurrency,
    recentExpenses,
    recentTransactions,
  };
}
