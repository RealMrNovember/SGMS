'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { applyPaymentToExpenses } from '@/lib/billing/settle-payment';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import type { OrganizationRole, PaymentMethod } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { decimalToNumber } from '@/lib/member-balance';

export type ExpenseActionState = {
  error?: string;
  success?: string;
};

export async function getExpenseContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const role = session.user.role;

  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Cari hesap işlemleri için OWNER, ADMIN veya STAFF yetkisi gerekir.' as const };
  }

  return { organizationId, userId, role };
}

const addExpenseSchema = z.object({
  gymMemberId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  amount: z.coerce.number().positive().max(1_000_000),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
});

export async function addMemberExpense(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = addExpenseSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    categoryId: formData.get('categoryId') || undefined,
    amount: formData.get('amount'),
    description: formData.get('description') || undefined,
    currency: formData.get('currency') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz form verisi.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  let categoryName: string | null = null;
  if (parsed.data.categoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: parsed.data.categoryId,
        organizationId: context.organizationId,
        isActive: true,
      },
    });
    if (!category) {
      return { error: 'Kategori bulunamadı.' };
    }
    categoryName = category.name;
  }

  const currency = parsed.data.currency ?? 'TRY';
  const description =
    parsed.data.description?.trim() ||
    categoryName ||
    'Salon harcaması';

  const expense = await prisma.expense.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId: parsed.data.gymMemberId,
      categoryId: parsed.data.categoryId ?? null,
      amount: parsed.data.amount,
      currency,
      description,
      status: 'OPEN',
      createdById: context.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { gymMemberId: parsed.data.gymMemberId, amount: parsed.data.amount },
    },
  });

  revalidatePath(`/dashboard/members/${parsed.data.gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');

  return { success: 'Borç kaydı eklendi.' };
}

export async function quickAddCategoryExpense(
  gymMemberId: string,
  categoryId: string,
): Promise<ExpenseActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const [member, category] = await Promise.all([
    prisma.gymMember.findFirst({
      where: { id: gymMemberId, organizationId: context.organizationId },
    }),
    prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId: context.organizationId, isActive: true },
    }),
  ]);

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }
  if (!category || category.defaultAmount == null) {
    return { error: 'Kategori veya varsayılan tutar bulunamadı.' };
  }

  const expense = await prisma.expense.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId,
      categoryId: category.id,
      amount: category.defaultAmount,
      currency: 'TRY',
      description: category.name,
      status: 'OPEN',
      createdById: context.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { gymMemberId, categoryId, quick: true },
    },
  });

  revalidatePath(`/dashboard/members/${gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');

  return { success: `${category.name} eklendi.` };
}

const paymentSchema = z.object({
  gymMemberId: z.string().cuid(),
  amount: z.coerce.number().positive().max(1_000_000),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']),
  notes: z.string().max(500).optional(),
  expenseId: z.string().cuid().optional(),
});

export async function recordPayment(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = paymentSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    amount: formData.get('amount'),
    paymentMethod: formData.get('paymentMethod'),
    notes: formData.get('notes') || undefined,
    expenseId: formData.get('expenseId') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz ödeme verisi.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: parsed.data.gymMemberId,
        expenseId: parsed.data.expenseId ?? null,
        amount: parsed.data.amount,
        currency: 'TRY',
        type: 'PAYMENT',
        paymentMethod: parsed.data.paymentMethod as PaymentMethod,
        notes: parsed.data.notes ?? null,
        createdById: context.userId,
      },
    });

    await applyPaymentToExpenses(tx, {
      organizationId: context.organizationId,
      gymMemberId: parsed.data.gymMemberId,
      amount: parsed.data.amount,
      targetExpenseId: parsed.data.expenseId,
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'PAYMENT_RECORDED',
        entityType: 'transaction',
        entityId: transaction.id,
        metadata: {
          gymMemberId: parsed.data.gymMemberId,
          amount: parsed.data.amount,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${parsed.data.gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');

  return { success: 'Tahsilat kaydedildi.' };
}

export async function voidExpense(expenseId: string): Promise<ExpenseActionState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' };
  }

  const role = session.user.role;
  if (!role || !new Set<OrganizationRole>(['OWNER', 'ADMIN']).has(role)) {
    return { error: 'Borç iptali için OWNER veya ADMIN yetkisi gerekir.' };
  }

  const writeBlock = await getTenantWriteBlockReason(session.user.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, organizationId: session.user.organizationId, status: 'OPEN' },
  });

  if (!expense) {
    return { error: 'Açık borç kaydı bulunamadı.' };
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: { status: 'VOID', voidedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      organizationId: session.user.organizationId,
      action: 'EXPENSE_VOIDED',
      entityType: 'expense',
      entityId: expenseId,
      metadata: { gymMemberId: expense.gymMemberId },
    },
  });

  revalidatePath(`/dashboard/members/${expense.gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');

  return { success: 'Borç iptal edildi.' };
}

const categorySchema = z.object({
  categoryId: z.string().cuid().optional(),
  name: z.string().min(1).max(80),
  defaultAmount: z.coerce.number().positive().max(1_000_000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export async function saveExpenseCategory(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' };
  }

  const role = session.user.role;
  if (!role || !new Set<OrganizationRole>(['OWNER', 'ADMIN']).has(role)) {
    return { error: 'Kategori yönetimi için OWNER veya ADMIN yetkisi gerekir.' };
  }

  const parsed = categorySchema.safeParse({
    categoryId: formData.get('categoryId') || undefined,
    name: formData.get('name'),
    defaultAmount: formData.get('defaultAmount') || undefined,
    sortOrder: formData.get('sortOrder') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz kategori verisi.' };
  }

  const { categoryId, name, defaultAmount, sortOrder } = parsed.data;

  if (categoryId) {
    const existing = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return { error: 'Kategori bulunamadı.' };
    }
    await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: {
        name,
        defaultAmount: defaultAmount ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
  } else {
    await prisma.expenseCategory.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        defaultAmount: defaultAmount ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
  }

  revalidatePath('/dashboard/pos');
  return { success: 'Kategori kaydedildi.' };
}

export async function setExpenseCategoryActive(
  categoryId: string,
  isActive: boolean,
): Promise<ExpenseActionState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' };
  }

  const role = session.user.role;
  if (!role || !new Set<OrganizationRole>(['OWNER', 'ADMIN']).has(role)) {
    return { error: 'Kategori yönetimi için OWNER veya ADMIN yetkisi gerekir.' };
  }

  await prisma.expenseCategory.updateMany({
    where: { id: categoryId, organizationId: session.user.organizationId },
    data: { isActive },
  });

  revalidatePath('/dashboard/pos');
  return { success: isActive ? 'Kategori etkinleştirildi.' : 'Kategori devre dışı bırakıldı.' };
}

export async function getMemberPosSnapshot(gymMemberId: string) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' as const };
  }

  const organizationId = session.user.organizationId;
  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    select: { id: true, firstName: true, lastName: true, status: true },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' as const };
  }

  const [openAgg, recentExpenses, overdueInstallment] = await Promise.all([
    prisma.expense.aggregate({
      where: { organizationId, gymMemberId, status: 'OPEN' },
      _sum: { amount: true, paidAmount: true },
    }),
    prisma.expense.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        createdAt: true,
        category: { select: { name: true } },
      },
    }),
    prisma.expense.findFirst({
      where: {
        organizationId,
        gymMemberId,
        status: 'OPEN',
        paymentPlanId: { not: null },
        dueDate: { lt: new Date() },
      },
      select: { id: true },
    }),
  ]);

  const openBalance =
    decimalToNumber(openAgg._sum.amount) - decimalToNumber(openAgg._sum.paidAmount);

  return {
    member,
    openBalance,
    hasOverdueInstallment: overdueInstallment != null,
    recentExpenses: recentExpenses.map((e) => ({
      ...e,
      amount: e.amount.toString(),
    })),
  };
}
