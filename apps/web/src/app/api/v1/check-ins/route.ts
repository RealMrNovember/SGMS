import { requireTenantApiContext } from '@/lib/api/guard';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request, {
    roles: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'],
  });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const { limit, cursor } = parseListParams(request);
  const url = new URL(request.url);
  const sinceHours = Number(url.searchParams.get('sinceHours') ?? '24');
  const since = new Date(Date.now() - (Number.isFinite(sinceHours) ? sinceHours : 24) * 60 * 60 * 1000);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.checkIn.findMany({
      where: {
        organizationId: context.organizationId,
        checkedInAt: { gte: since },
      },
      orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }],
      include: {
        gymMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        device: { select: { id: true, name: true, type: true } },
      },
      ...page,
    }),
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.checkIn.count({
    where: {
      organizationId: context.organizationId,
      checkedInAt: { gte: todayStart },
    },
  });

  return apiOk({
    checkIns: items,
    count: items.length,
    todayCount,
    hasMore,
    nextCursor,
  });
}
