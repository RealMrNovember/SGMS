'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { applyPaymentToExpenses, applyRefundToExpenses } from '@/lib/billing/settle-payment';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import type { OrganizationRole, PaymentMethod } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  decimalToNumber,
  getMemberOpenBalancesByCurrency,
  getMemberOpenCurrencyCodes,
} from '@/lib/member-balance';

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

  const currency = (parsed.data.currency ?? 'TRY').toUpperCase();
  const description =
    parsed.data.description?.trim() ||
    categoryName ||
    'Salon harcaması';

  const openCurrencies = await getMemberOpenCurrencyCodes(
    context.organizationId,
    parsed.data.gymMemberId,
  );
  if (openCurrencies.length > 0 && !openCurrencies.includes(currency)) {
    return {
      error: `Üyenin açık borçları ${openCurrencies.join(', ')} cinsinden. Farklı para birimi (${currency}) ekleyemezsiniz; önce mevcut borcu kapatın veya aynı para birimini kullanın.`,
    };
  }

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

  const currency = 'TRY';
  const openCurrencies = await getMemberOpenCurrencyCodes(context.organizationId, gymMemberId);
  if (openCurrencies.length > 0 && !openCurrencies.includes(currency)) {
    return {
      error: `Üyenin açık borçları ${openCurrencies.join(', ')} cinsinden. Farklı para birimi (${currency}) ekleyemezsiniz; önce mevcut borcu kapatın veya aynı para birimini kullanın.`,
    };
  }

  const expense = await prisma.expense.create({
    data: {
      organizationId: context.organizationId,
      gymMemberId,
      categoryId: category.id,
      amount: category.defaultAmount,
      currency,
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
  currency: z.string().length(3).optional(),
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
    currency: formData.get('currency') || undefined,
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

  let currency = parsed.data.currency?.toUpperCase();

  if (parsed.data.expenseId) {
    const targetExpense = await prisma.expense.findFirst({
      where: {
        id: parsed.data.expenseId,
        organizationId: context.organizationId,
        gymMemberId: parsed.data.gymMemberId,
      },
      select: { currency: true },
    });
    if (!targetExpense) {
      return { error: 'Hedef borç kaydı bulunamadı.' };
    }
    currency = targetExpense.currency.toUpperCase();
  }

  if (!currency) {
    const openCodes = await getMemberOpenCurrencyCodes(
      context.organizationId,
      parsed.data.gymMemberId,
    );
    if (openCodes.length === 1) {
      currency = openCodes[0];
    } else if (openCodes.length === 0) {
      currency = 'TRY';
    } else {
      return {
        error: `Birden fazla para biriminde açık borç var (${openCodes.join(', ')}). Lütfen para birimi seçin veya belirli bir borcu hedefleyin.`,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: parsed.data.gymMemberId,
        expenseId: parsed.data.expenseId ?? null,
        amount: parsed.data.amount,
        currency,
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
      currency,
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
          currency,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${parsed.data.gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');

  return { success: `Tahsilat kaydedildi (${currency}).` };
}

const refundSchema = z.object({
  transactionId: z.string().cuid(),
  amount: z.coerce.number().positive().max(1_000_000),
  reason: z.string().min(3).max(500),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
});

/**
 * Tahsilat iadesi (36.9) — kısmi/tam; Expense.paidAmount geri alınır.
 */
export async function recordRefund(
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

  const parsed = refundSchema.safeParse({
    transactionId: formData.get('transactionId'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    paymentMethod: formData.get('paymentMethod') || undefined,
  });

  if (!parsed.success) {
    return { error: 'İade tutarı ve gerekçe (en az 3 karakter) zorunludur.' };
  }

  const original = await prisma.transaction.findFirst({
    where: {
      id: parsed.data.transactionId,
      organizationId: context.organizationId,
      type: 'PAYMENT',
    },
    include: {
      refunds: { select: { amount: true } },
    },
  });

  if (!original) {
    return { error: 'İade edilecek tahsilat bulunamadı.' };
  }

  const alreadyRefunded = original.refunds.reduce(
    (sum, r) => sum + decimalToNumber(r.amount),
    0,
  );
  const maxRefundable = decimalToNumber(original.amount) - alreadyRefunded;
  if (parsed.data.amount > maxRefundable + 0.001) {
    return {
      error: `İade tutarı kalan iade edilebilir tutarı aşıyor (maks. ${maxRefundable.toFixed(2)} ${original.currency}).`,
    };
  }

  const currency = original.currency.toUpperCase();

  await prisma.$transaction(async (tx) => {
    const refund = await tx.transaction.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: original.gymMemberId,
        expenseId: original.expenseId,
        amount: parsed.data.amount,
        currency,
        type: 'REFUND',
        paymentMethod: (parsed.data.paymentMethod ?? original.paymentMethod) as PaymentMethod,
        notes: parsed.data.reason.trim(),
        refundOfTransactionId: original.id,
        createdById: context.userId,
      },
    });

    await applyRefundToExpenses(tx, {
      organizationId: context.organizationId,
      gymMemberId: original.gymMemberId,
      amount: parsed.data.amount,
      currency,
      expenseId: original.expenseId,
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'REFUND_RECORDED',
        entityType: 'transaction',
        entityId: refund.id,
        metadata: {
          gymMemberId: original.gymMemberId,
          amount: parsed.data.amount,
          currency,
          refundOfTransactionId: original.id,
          reason: parsed.data.reason.trim(),
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${original.gymMemberId}`);
  revalidatePath('/athlete/account');
  revalidatePath('/dashboard/pos');
  revalidatePath('/dashboard/reports');

  return {
    success: `${parsed.data.amount.toFixed(2)} ${currency} iade edildi.`,
  };
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

  const [openBalances, recentExpenses, overdueInstallment] = await Promise.all([
    getMemberOpenBalancesByCurrency(organizationId, gymMemberId),
    prisma.expense.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
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

  const balanceKeys = Object.keys(openBalances);
  const openBalance =
    balanceKeys.length === 1
      ? openBalances[balanceKeys[0]!]!
      : openBalances.TRY ?? balanceKeys.reduce((s, k) => s + (openBalances[k] ?? 0), 0);

  return {
    member,
    openBalance,
    balancesByCurrency: openBalances,
    hasOverdueInstallment: overdueInstallment != null,
    recentExpenses: recentExpenses.map((e) => ({
      ...e,
      amount: e.amount.toString(),
    })),
  };
}
