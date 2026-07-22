import { apiError, apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

/** Salon slug'ına göre herkese açık paket listesi (self-signup / ilk satın alma). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) {
    return apiError('Salon kodu gerekli.', 400);
  }

  const org = await prisma.organization.findFirst({
    where: {
      slug,
      status: { in: ['ACTIVE', 'TRIAL'] },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      gymMembershipPlans: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          durationDays: true,
          price: true,
          currency: true,
        },
      },
    },
  });

  if (!org) {
    return apiError('Salon bulunamadı.', 404);
  }

  return apiOk({
    organization: { id: org.id, name: org.name, slug: org.slug },
    plans: org.gymMembershipPlans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      durationDays: p.durationDays,
      price: Number(p.price.toString()),
      currency: p.currency || 'TRY',
    })),
  });
}
