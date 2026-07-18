import {
  canManageMembers,
  requireTenantApiContext,
  requireTenantWriteAccess,
  resolveGymMemberFilter,
} from '@/lib/api/guard';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { decimalToNumber } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';

// Finansal veri — yalnızca resepsiyon/yönetim (OWNER/ADMIN/STAFF). TRAINER göremez (bkz. roadmap.md Faz 36.5).
export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request, { roles: ['OWNER', 'ADMIN', 'STAFF'] });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const requestedMemberId = new URL(request.url).searchParams.get('gymMemberId');
  const gymMemberFilter = resolveGymMemberFilter(context, requestedMemberId, request);
  if (typeof gymMemberFilter === 'object') {
    return gymMemberFilter.response;
  }

  const statusParam = new URL(request.url).searchParams.get('status');
  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.expense.findMany({
      where: {
        organizationId: context.organizationId,
        ...(gymMemberFilter ? { gymMemberId: gymMemberFilter } : {}),
        ...(statusParam === 'OPEN' || statusParam === 'PAID' || statusParam === 'VOID'
          ? { status: statusParam }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        gymMember: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page,
    }),
  );

  return apiOk({ expenses: items, count: items.length, hasMore, nextCursor });
}

export async function POST(request: Request) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;
  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  if (!canManageMembers(role)) {
    return apiErrorI18n('addExpenseRoleRequired', 403, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  const amount = body.amount != null ? Number(body.amount) : NaN;

  if (!gymMemberId || !Number.isFinite(amount) || amount <= 0) {
    return apiErrorI18n('expenseFieldsRequired', 400, request);
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
  });

  if (!member) {
    return apiErrorI18n('athleteNotInOrg', 404, request);
  }

  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : null;
  if (categoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId, isActive: true },
    });
    if (!category) {
      return apiErrorI18n('categoryNotFound', 404, request);
    }
  }

  const expense = await prisma.expense.create({
    data: {
      organizationId,
      gymMemberId,
      categoryId,
      amount,
      currency: typeof body.currency === 'string' ? body.currency : 'TRY',
      description:
        typeof body.description === 'string'
          ? body.description.trim()
          : 'Salon harcaması',
      status: 'OPEN',
      createdById: userId,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { gymMemberId, amount: decimalToNumber(expense.amount), source: 'api_v1' },
    },
  });

  return apiOk({ expense }, 201);
}
