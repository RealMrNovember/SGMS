import {
  canManageMembers,
  requireTenantApiContext,
  requireTenantWriteAccess,
  resolveGymMemberFilter,
} from '@/lib/api/guard';
import { fetchPage, parseListParams } from '@/lib/api/pagination';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { applyPaymentToExpenses } from '@/lib/billing/settle-payment';
import { prisma } from '@/lib/prisma';
import type { PaymentMethod, TransactionType } from '@sgms/database';

const PAYMENT_METHODS = new Set<PaymentMethod>(['CASH', 'CARD', 'TRANSFER']);

// Finansal veri — yalnızca resepsiyon/yönetim (OWNER/ADMIN/STAFF). TRAINER'ın hiçbir
// üyenin ödeme geçmişini görmemesi gerekir (bkz. roadmap.md Faz 36.5).
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

  const { limit, cursor } = parseListParams(request);

  const { items, hasMore, nextCursor } = await fetchPage(limit, cursor, (page) =>
    prisma.transaction.findMany({
      where: {
        organizationId: context.organizationId,
        ...(gymMemberFilter ? { gymMemberId: gymMemberFilter } : {}),
      },
      include: {
        gymMember: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page,
    }),
  );

  return apiOk({ transactions: items, count: items.length, hasMore, nextCursor });
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
    return apiErrorI18n('recordPaymentRoleRequired', 403, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  const gymMemberId = typeof body.gymMemberId === 'string' ? body.gymMemberId : '';
  const amount = body.amount != null ? Number(body.amount) : NaN;
  const type = typeof body.type === 'string' ? body.type : 'PAYMENT';
  const paymentMethod =
    typeof body.paymentMethod === 'string' ? body.paymentMethod : 'CASH';

  if (!gymMemberId || !Number.isFinite(amount) || amount <= 0) {
    return apiErrorI18n('expenseFieldsRequired', 400, request);
  }

  if (!PAYMENT_METHODS.has(paymentMethod as PaymentMethod)) {
    return apiErrorI18n('paymentMethodInvalid', 400, request);
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
  });

  if (!member) {
    return apiErrorI18n('athleteNotInOrg', 404, request);
  }

  const expenseId = typeof body.expenseId === 'string' ? body.expenseId : undefined;
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        organizationId,
        gymMemberId,
        expenseId: expenseId ?? null,
        amount,
        currency: typeof body.currency === 'string' ? body.currency : 'TRY',
        type: type as TransactionType,
        paymentMethod: paymentMethod as PaymentMethod,
        reference: typeof body.reference === 'string' ? body.reference : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdById: userId,
      },
    });

    if (type === 'PAYMENT') {
      await applyPaymentToExpenses(tx, {
        organizationId,
        gymMemberId,
        amount,
        targetExpenseId: expenseId,
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: userId,
        organizationId,
        action: 'PAYMENT_RECORDED',
        entityType: 'transaction',
        entityId: created.id,
        metadata: { gymMemberId, amount, source: 'api_v1' },
      },
    });

    return created;
  });

  return apiOk({ transaction }, 201);
}
