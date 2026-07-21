import type { Prisma } from '@sgms/database';

export type CategorySaleChannel = 'pos' | 'self_service';

export type SaleableCategory = {
  id: string;
  name: string;
  defaultAmount: Prisma.Decimal | number | string | null;
  stockQuantity: number | null;
};

export type CategorySaleResult = {
  id: string;
  amount: number;
};

/**
 * Bir `ExpenseCategory` satışını (stok düşümü + `Expense` satırı) atomik olarak
 * gerçekleştirir. POS'un tek-adetlik `quickAddCategoryExpense`'i (Faz 17.6) ile
 * mobil mağazanın (Faz 40) çok-adetli sepet satırı **aynı bu fonksiyonu**
 * kullanır — stok her zaman tek yerden, tek şekilde düşer.
 *
 * `channel: 'pos'` → ürün fiziksel olarak anında teslim edilmiş sayılır
 * (`deliveredAt` hemen doldurulur). `channel: 'self_service'` → mobil
 * mağazadan online satın alınmıştır, resepsiyon fiziksel teslimatı elle
 * işaretleyene kadar (`/dashboard/pos` — "Bekleyen Teslimatlar") `deliveredAt`
 * boş kalır.
 */
export async function createCategorySaleExpense(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    gymMemberId: string;
    category: SaleableCategory;
    createdById: string;
    quantity: number;
    channel: CategorySaleChannel;
  },
): Promise<CategorySaleResult> {
  const { organizationId, gymMemberId, category, createdById, quantity, channel } = params;

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Geçersiz adet.');
  }
  if (category.defaultAmount == null) {
    throw new Error(`"${category.name}" için varsayılan tutar tanımlı değil.`);
  }

  if (category.stockQuantity != null) {
    const updated = await tx.expenseCategory.updateMany({
      where: { id: category.id, organizationId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (updated.count === 0) {
      throw new Error(`"${category.name}" stokta yok.`);
    }
  }

  const unitAmount = Number(category.defaultAmount);
  const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
  const description = quantity > 1 ? `${category.name} x${quantity}` : category.name;

  const expense = await tx.expense.create({
    data: {
      organizationId,
      gymMemberId,
      categoryId: category.id,
      amount: totalAmount,
      currency: 'TRY',
      description,
      status: 'OPEN',
      createdById,
      deliveredAt: channel === 'pos' ? new Date() : null,
    },
  });

  return { id: expense.id, amount: totalAmount };
}
