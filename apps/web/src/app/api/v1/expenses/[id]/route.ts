import { requireTenantApiContext, requireTenantWriteAccess } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { apiOk } from '@/lib/api/response';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';

const VOID_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;
  if (!VOID_ROLES.has(role)) {
    return apiErrorI18n('voidExpenseRoleRequired', 403, request);
  }

  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const { id } = await params;
  const existing = await prisma.expense.findFirst({
    where: { id, organizationId, status: 'OPEN' },
  });

  if (!existing) {
    return apiErrorI18n('openExpenseNotFound', 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiErrorI18n('invalidJson', 400, request);
  }

  if (typeof body.status === 'string' && body.status === 'VOID') {
    const expense = await prisma.expense.update({
      where: { id },
      data: { status: 'VOID', voidedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        organizationId,
        action: 'EXPENSE_VOIDED',
        entityType: 'expense',
        entityId: id,
        metadata: { source: 'api_v1' },
      },
    });

    return apiOk({ expense });
  }

  return apiErrorI18n('unsupportedExpenseUpdate', 400, request);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireTenantApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, role, userId } = authResult.context;
  if (!VOID_ROLES.has(role)) {
    return apiErrorI18n('voidExpenseRoleRequired', 403, request);
  }

  const writeBlock = await requireTenantWriteAccess(organizationId, request);
  if (writeBlock) {
    return writeBlock.response;
  }

  const { id } = await params;
  const existing = await prisma.expense.findFirst({
    where: { id, organizationId, status: 'OPEN' },
  });

  if (!existing) {
    return apiErrorI18n('openExpenseNotFound', 404, request);
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: { status: 'VOID', voidedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      organizationId,
      action: 'EXPENSE_VOIDED',
      entityType: 'expense',
      entityId: id,
      metadata: { source: 'api_v1' },
    },
  });

  return apiOk({ expense, voided: true });
}
