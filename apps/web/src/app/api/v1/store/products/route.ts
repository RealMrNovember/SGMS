import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

/**
 * Faz 40 — mobil "Mağaza" ekranı. Yalnızca personelin `/dashboard/pos`'ta
 * bilerek "Mobil mağazada göster" işaretlediği (`isStoreVisible: true`) ve
 * stokta olan (veya stok takibi hiç yapılmayan) kategoriler listelenir.
 */
export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId } = authResult.context;

  const categories = await prisma.expenseCategory.findMany({
    where: {
      organizationId,
      isActive: true,
      isStoreVisible: true,
      OR: [{ stockQuantity: null }, { stockQuantity: { gt: 0 } }],
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      defaultAmount: true,
      imageUrl: true,
      stockQuantity: true,
    },
  });

  return apiOk({
    products: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      price: c.defaultAmount?.toString() ?? '0',
      imageUrl: c.imageUrl,
      stockQuantity: c.stockQuantity,
    })),
  });
}
