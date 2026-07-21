import { describe, expect, it } from 'vitest';
import { applyPaymentToExpenses, applyPaymentToSpecificExpenses, applyRefundToExpenses } from './settle-payment';

type FakeExpense = {
  id: string;
  organizationId: string;
  gymMemberId: string;
  status: 'OPEN' | 'PAID' | 'VOID';
  amount: number;
  paidAmount: number;
  currency: string;
  dueDate: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  updatedAt: Date;
};

function createFakeTx(expenses: FakeExpense[]) {
  return {
    expense: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (
          expenses.find((e) => {
            if (where.id && e.id !== where.id) return false;
            if (where.organizationId && e.organizationId !== where.organizationId) return false;
            if (where.gymMemberId && e.gymMemberId !== where.gymMemberId) return false;
            if (where.currency && e.currency !== where.currency) return false;
            if (where.status) {
              if (typeof where.status === 'string' && e.status !== where.status) return false;
              if (
                typeof where.status === 'object' &&
                where.status !== null &&
                'in' in where.status &&
                !(where.status as { in: string[] }).in.includes(e.status)
              ) {
                return false;
              }
            }
            return true;
          }) ?? null
        );
      },
      async findMany({ where }: { where: Record<string, unknown> }) {
        let result = expenses.filter((e) => {
          if (where.id && typeof where.id === 'object' && 'in' in where.id) {
            if (!(where.id as { in: string[] }).in.includes(e.id)) return false;
          }
          if (e.organizationId !== where.organizationId) return false;
          if (e.gymMemberId !== where.gymMemberId) return false;
          if (where.currency && e.currency !== where.currency) return false;
          if (where.status) {
            if (typeof where.status === 'string' && e.status !== where.status) return false;
            if (
              typeof where.status === 'object' &&
              where.status !== null &&
              'in' in where.status &&
              !(where.status as { in: string[] }).in.includes(e.status)
            ) {
              return false;
            }
          }
          if (where.paidAmount && typeof where.paidAmount === 'object' && 'gt' in where.paidAmount) {
            if (!(e.paidAmount > (where.paidAmount as { gt: number }).gt)) return false;
          }
          return true;
        });
        const idFilter = where.id as { not?: string } | undefined;
        if (idFilter?.not) {
          result = result.filter((e) => e.id !== idFilter.not);
        }
        return [...result].sort((a, b) => {
          if (a.dueDate == null && b.dueDate == null) {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }
          if (a.dueDate == null) return 1;
          if (b.dueDate == null) return -1;
          const diff = a.dueDate.getTime() - b.dueDate.getTime();
          return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
        });
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const expense = expenses.find((e) => e.id === where.id);
        if (!expense) throw new Error('not found');
        Object.assign(expense, data);
        return expense;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeExpense(overrides: Partial<FakeExpense> & { id: string }): FakeExpense {
  return {
    organizationId: 'org1',
    gymMemberId: 'member1',
    status: 'OPEN',
    amount: 100,
    paidAmount: 0,
    currency: 'TRY',
    dueDate: null,
    createdAt: new Date('2026-01-01'),
    paidAt: null,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('applyPaymentToExpenses', () => {
  it('fully pays a single open expense', async () => {
    const expenses = [makeExpense({ id: 'e1', amount: 100 })];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 100,
      currency: 'TRY',
    });

    expect(remaining).toBe(0);
    expect(expenses[0].status).toBe('PAID');
    expect(expenses[0].paidAmount).toBe(100);
  });

  it('does not apply a TRY payment to a USD open expense', async () => {
    const expenses = [makeExpense({ id: 'usd', amount: 100, currency: 'USD' })];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 100,
      currency: 'TRY',
    });

    expect(remaining).toBe(100);
    expect(expenses[0].paidAmount).toBe(0);
    expect(expenses[0].status).toBe('OPEN');
  });

  it('pays only matching-currency debts when both TRY and USD are open', async () => {
    const expenses = [
      makeExpense({ id: 'try', amount: 50, currency: 'TRY', dueDate: new Date('2026-01-01') }),
      makeExpense({ id: 'usd', amount: 80, currency: 'USD', dueDate: new Date('2026-01-01') }),
    ];
    const tx = createFakeTx(expenses);

    await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 50,
      currency: 'USD',
    });

    expect(expenses.find((e) => e.id === 'usd')!.paidAmount).toBe(50);
    expect(expenses.find((e) => e.id === 'try')!.paidAmount).toBe(0);
  });

  it('applies a true partial payment to the oldest open expense', async () => {
    const expenses = [makeExpense({ id: 'e1', amount: 100 })];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 40,
      currency: 'TRY',
    });

    expect(remaining).toBe(0);
    expect(expenses[0].status).toBe('OPEN');
    expect(expenses[0].paidAmount).toBe(40);
  });
});

describe('applyPaymentToSpecificExpenses', () => {
  it('pays exactly the requested expense ids and leaves an unrelated open debt untouched', async () => {
    const expenses = [
      makeExpense({ id: 'store1', amount: 50 }),
      makeExpense({ id: 'store2', amount: 30 }),
      makeExpense({ id: 'unrelated', amount: 200 }),
    ];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToSpecificExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 80,
      currency: 'TRY',
      expenseIds: ['store1', 'store2'],
    });

    expect(remaining).toBe(0);
    expect(expenses.find((e) => e.id === 'store1')!.status).toBe('PAID');
    expect(expenses.find((e) => e.id === 'store2')!.status).toBe('PAID');
    expect(expenses.find((e) => e.id === 'unrelated')!.status).toBe('OPEN');
    expect(expenses.find((e) => e.id === 'unrelated')!.paidAmount).toBe(0);
  });

  it('returns an empty result when expenseIds is empty', async () => {
    const expenses = [makeExpense({ id: 'e1', amount: 100 })];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToSpecificExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 100,
      currency: 'TRY',
      expenseIds: [],
    });

    expect(remaining).toBe(100);
    expect(expenses[0].status).toBe('OPEN');
  });
});

describe('applyRefundToExpenses', () => {
  it('reduces paidAmount and reopens a PAID expense', async () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        amount: 100,
        paidAmount: 100,
        status: 'PAID',
        paidAt: new Date('2026-01-02'),
      }),
    ];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyRefundToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 40,
      currency: 'TRY',
      expenseId: 'e1',
    });

    expect(remaining).toBe(0);
    expect(expenses[0].paidAmount).toBe(60);
    expect(expenses[0].status).toBe('OPEN');
    expect(expenses[0].paidAt).toBeNull();
  });
});
