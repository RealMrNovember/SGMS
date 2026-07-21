import { describe, expect, it } from 'vitest';
import { createCategorySaleExpense } from './category-sale';

type FakeCategory = {
  id: string;
  organizationId: string;
  name: string;
  defaultAmount: number | null;
  stockQuantity: number | null;
};

function createFakeTx(categories: FakeCategory[]) {
  const expenses: Array<Record<string, unknown>> = [];

  return {
    tx: {
      expenseCategory: {
        async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
          const category = categories.find((c) => {
            if (c.id !== where.id || c.organizationId !== where.organizationId) return false;
            if (where.stockQuantity && typeof where.stockQuantity === 'object' && 'gte' in where.stockQuantity) {
              const minQty = (where.stockQuantity as { gte: number }).gte;
              return c.stockQuantity != null && c.stockQuantity >= minQty;
            }
            return true;
          });
          if (!category) return { count: 0 };
          const decrement =
            data.stockQuantity && typeof data.stockQuantity === 'object' && 'decrement' in data.stockQuantity
              ? (data.stockQuantity as { decrement: number }).decrement
              : 0;
          category.stockQuantity = (category.stockQuantity ?? 0) - decrement;
          return { count: 1 };
        },
      },
      expense: {
        async create({ data }: { data: Record<string, unknown> }) {
          const record = { id: `exp_${expenses.length + 1}`, ...data };
          expenses.push(record);
          return record;
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    categories,
    expenses,
  };
}

describe('createCategorySaleExpense', () => {
  it('decrements stock by quantity and multiplies the total amount', async () => {
    const { tx, categories, expenses } = createFakeTx([
      { id: 'cat1', organizationId: 'org1', name: 'Su', defaultAmount: 25, stockQuantity: 10 },
    ]);

    const result = await createCategorySaleExpense(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      category: categories[0],
      createdById: 'user1',
      quantity: 3,
      channel: 'self_service',
    });

    expect(result.amount).toBe(75);
    expect(categories[0].stockQuantity).toBe(7);
    expect(expenses[0].amount).toBe(75);
    expect(expenses[0].description).toBe('Su x3');
    expect(expenses[0].deliveredAt).toBeNull();
  });

  it('uses the plain category name (no "x1") and marks POS sales as delivered immediately', async () => {
    const { tx, categories, expenses } = createFakeTx([
      { id: 'cat1', organizationId: 'org1', name: 'Protein Bar', defaultAmount: 40, stockQuantity: 5 },
    ]);

    await createCategorySaleExpense(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      category: categories[0],
      createdById: 'staff1',
      quantity: 1,
      channel: 'pos',
    });

    expect(expenses[0].description).toBe('Protein Bar');
    expect(expenses[0].deliveredAt).toBeInstanceOf(Date);
  });

  it('throws when requested quantity exceeds stock', async () => {
    const { tx, categories } = createFakeTx([
      { id: 'cat1', organizationId: 'org1', name: 'Havlu', defaultAmount: 60, stockQuantity: 2 },
    ]);

    await expect(
      createCategorySaleExpense(tx, {
        organizationId: 'org1',
        gymMemberId: 'member1',
        category: categories[0],
        createdById: 'user1',
        quantity: 3,
        channel: 'self_service',
      }),
    ).rejects.toThrow('stokta yok');
  });

  it('does not touch stock for categories without stock tracking', async () => {
    const { tx, categories, expenses } = createFakeTx([
      { id: 'cat1', organizationId: 'org1', name: 'Kişisel Antrenman', defaultAmount: 300, stockQuantity: null },
    ]);

    await createCategorySaleExpense(tx, {
      organizationId: 'org1',
      gymMemberId: 'member1',
      category: categories[0],
      createdById: 'user1',
      quantity: 2,
      channel: 'self_service',
    });

    expect(categories[0].stockQuantity).toBeNull();
    expect(expenses[0].amount).toBe(600);
  });

  it('throws when the category has no default amount', async () => {
    const { tx, categories } = createFakeTx([
      { id: 'cat1', organizationId: 'org1', name: 'Özel', defaultAmount: null, stockQuantity: null },
    ]);

    await expect(
      createCategorySaleExpense(tx, {
        organizationId: 'org1',
        gymMemberId: 'member1',
        category: categories[0],
        createdById: 'user1',
        quantity: 1,
        channel: 'pos',
      }),
    ).rejects.toThrow('varsayılan tutar tanımlı değil');
  });
});
