import { describe, expect, it } from 'vitest';
import { applyPaymentToExpenses } from './settle-payment';

type FakeExpense = {
  id: string;
  organizationId: string;
  gymMemberId: string;
  status: 'OPEN' | 'PAID' | 'VOID';
  amount: number;
  paidAmount: number;
  dueDate: Date | null;
  createdAt: Date;
  paidAt: Date | null;
};

function createFakeTx(expenses: FakeExpense[]) {
  return {
    expense: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (
          expenses.find(
            (e) =>
              e.id === where.id &&
              e.organizationId === where.organizationId &&
              e.gymMemberId === where.gymMemberId &&
              (where.status === undefined || e.status === where.status),
          ) ?? null
        );
      },
      async findMany({ where }: { where: Record<string, unknown> }) {
        let result = expenses.filter(
          (e) =>
            e.organizationId === where.organizationId &&
            e.gymMemberId === where.gymMemberId &&
            e.status === where.status,
        );
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
    dueDate: null,
    createdAt: new Date('2026-01-01'),
    paidAt: null,
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
    });

    expect(remaining).toBe(0);
    expect(expenses[0].status).toBe('PAID');
    expect(expenses[0].paidAmount).toBe(100);
  });

  it('pays off multiple open expenses in full FIFO order', async () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 50, dueDate: new Date('2026-01-01') }),
      makeExpense({ id: 'e2', amount: 50, dueDate: new Date('2026-01-02') }),
    ];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 100,
    });

    expect(remaining).toBe(0);
    expect(expenses[0].status).toBe('PAID');
    expect(expenses[1].status).toBe('PAID');
  });

  it('applies a true partial payment to the oldest open expense instead of skipping it', async () => {
    // Regression test: the previous implementation only closed an expense if the
    // payment could cover it in full, silently skipping any partial coverage.
    const expenses = [makeExpense({ id: 'e1', amount: 100 })];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 40,
    });

    expect(remaining).toBe(0);
    expect(expenses[0].status).toBe('OPEN');
    expect(expenses[0].paidAmount).toBe(40);
  });

  it('applies a partial payment to the oldest (due-first) expense rather than fully paying a smaller newer one', async () => {
    const expenses = [
      makeExpense({ id: 'older', amount: 100, dueDate: new Date('2026-01-01') }),
      makeExpense({ id: 'newer', amount: 30, dueDate: new Date('2026-01-05') }),
    ];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 40,
    });

    expect(remaining).toBe(0);
    const older = expenses.find((e) => e.id === 'older')!;
    const newer = expenses.find((e) => e.id === 'newer')!;
    expect(older.paidAmount).toBe(40);
    expect(older.status).toBe('OPEN');
    expect(newer.paidAmount).toBe(0);
    expect(newer.status).toBe('OPEN');
  });

  it('applies a targeted payment to a specific installment and spills the remainder into FIFO', async () => {
    const expenses = [
      makeExpense({ id: 'target', amount: 20, dueDate: new Date('2026-01-01') }),
      makeExpense({ id: 'other', amount: 100, dueDate: new Date('2026-01-02') }),
    ];
    const tx = createFakeTx(expenses);

    const { remaining } = await applyPaymentToExpenses(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      amount: 50,
      targetExpenseId: 'target',
    });

    expect(remaining).toBe(0);
    const target = expenses.find((e) => e.id === 'target')!;
    const other = expenses.find((e) => e.id === 'other')!;
    expect(target.status).toBe('PAID');
    expect(target.paidAmount).toBe(20);
    expect(other.status).toBe('OPEN');
    expect(other.paidAmount).toBe(30);
  });

  it('closes an installment across multiple partial payments over separate visits', async () => {
    const expenses = [makeExpense({ id: 'e1', amount: 90 })];
    const tx = createFakeTx(expenses);

    await applyPaymentToExpenses(tx, { organizationId: 'org1', gymMemberId: 'member1', amount: 30 });
    expect(expenses[0].paidAmount).toBe(30);
    expect(expenses[0].status).toBe('OPEN');

    await applyPaymentToExpenses(tx, { organizationId: 'org1', gymMemberId: 'member1', amount: 30 });
    expect(expenses[0].paidAmount).toBe(60);
    expect(expenses[0].status).toBe('OPEN');

    await applyPaymentToExpenses(tx, { organizationId: 'org1', gymMemberId: 'member1', amount: 30 });
    expect(expenses[0].paidAmount).toBe(90);
    expect(expenses[0].status).toBe('PAID');
  });
});
