import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

/**
 * Faz 40 — "Siparişlerim". Yeni bir sipariş tablosu icat edilmez: mevcut
 * `Expense` kayıtlarından, mağazada gösterilen bir kategoriye ait olanlar
 * filtrelenir (aynen `/athlete/account`'taki "Son Harcamalar" gibi, sadece
 * mağaza ürünlerine daraltılmış hali).
 */
export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  const orders = await prisma.expense.findMany({
    where: {
      organizationId,
      gymMemberId,
      status: { not: 'VOID' },
      category: { isStoreVisible: true },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      deliveredAt: true,
      createdAt: true,
      category: { select: { name: true, imageUrl: true } },
    },
  });

  return apiOk({
    orders: orders.map((o) => ({
      id: o.id,
      productName: o.category?.name ?? o.description ?? 'Ürün',
      imageUrl: o.category?.imageUrl ?? null,
      amount: o.amount.toString(),
      status: o.status,
      delivered: o.deliveredAt != null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
