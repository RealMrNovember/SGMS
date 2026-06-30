export function parseListParams(
  request: Request,
  options?: { defaultLimit?: number; maxLimit?: number },
) {
  const url = new URL(request.url);
  const maxLimit = options?.maxLimit ?? 100;
  const defaultLimit = options?.defaultLimit ?? 20;
  const parsed = parseInt(url.searchParams.get('limit') ?? String(defaultLimit), 10);
  const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : defaultLimit, 1), maxLimit);
  const cursor = url.searchParams.get('cursor') ?? undefined;
  return { limit, cursor };
}

export function paginateResult<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];
  return {
    items: pageItems,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
    },
  };
}

type PageArgs = { take: number } | { take: number; cursor: { id: string }; skip: 1 };

export async function fetchPage<T extends { id: string }>(
  limit: number,
  cursor: string | undefined,
  fetch: (page: PageArgs) => Promise<T[]>,
) {
  const page: PageArgs = cursor
    ? { take: limit + 1, cursor: { id: cursor }, skip: 1 }
    : { take: limit + 1 };

  const items = await fetch(page);
  const { items: pageItems, pageInfo } = paginateResult(items, limit);
  return { items: pageItems, ...pageInfo };
}
