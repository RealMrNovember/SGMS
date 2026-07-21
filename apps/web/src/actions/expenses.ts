'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { applyPaymentToExpenses, applyRefundToExpenses } from '@/lib/billing/settle-payment';
import { issueInvoiceFromPayment } from '@/actions/invoices';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import type { OrganizationRole, PaymentMethod } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { resolveCashShiftForPayment } from '@/actions/cash-register';
import {
  decimalToNumber,
  getMemberOpenBalancesByCurrency,
  getMemberOpenCurrencyCodes,
} from '@/lib/member-balance';
import { createCategorySaleExpense } from '@/lib/store/category-sale';

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
  let stockCategoryId: string | null = null;
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
    if (category.stockQuantity != null) {
      if (category.stockQuantity <= 0) {
        return { error: `"${category.name}" stokta kalmadı.` };
      }
      stockCategoryId = category.id;
    }
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

  const expense = await prisma.$transaction(async (tx) => {
    if (stockCategoryId) {
      const updated = await tx.expenseCategory.updateMany({
        where: {
          id: stockCategoryId,
          organizationId: context.organizationId,
          stockQuantity: { gt: 0 },
        },
        data: { stockQuantity: { decrement: 1 } },
      });
      if (updated.count === 0) {
        throw new Error('STOCK_DEPLETED');
      }
    }

    const created = await tx.expense.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: parsed.data.gymMemberId,
        categoryId: parsed.data.categoryId ?? null,
        amount: parsed.data.amount,
        currency,
        description,
        status: 'OPEN',
        createdById: context.userId,
        // Faz 40 — personel elden eklediği bir kategori satırı fiziksel olarak
        // anında teslim edilmiş sayılır (Bekleyen Teslimatlar kuyruğuna girmez).
        deliveredAt: parsed.data.categoryId ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'EXPENSE_ADDED',
        entityType: 'expense',
        entityId: created.id,
        metadata: { gymMemberId: parsed.data.gymMemberId, amount: parsed.data.amount },
      },
    });

    return created;
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === 'STOCK_DEPLETED') {
      return null;
    }
    throw err;
  });

  if (!expense) {
    return { error: 'Stok yetersiz — işlem iptal edildi.' };
  }

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

  if (category.stockQuantity != null && category.stockQuantity <= 0) {
    return { error: `"${category.name}" stokta yok.` };
  }

  const currency = 'TRY';
  const openCurrencies = await getMemberOpenCurrencyCodes(context.organizationId, gymMemberId);
  if (openCurrencies.length > 0 && !openCurrencies.includes(currency)) {
    return {
      error: `Üyenin açık borçları ${openCurrencies.join(', ')} cinsinden. Farklı para birimi (${currency}) ekleyemezsiniz; önce mevcut borcu kapatın veya aynı para birimini kullanın.`,
    };
  }

  const expense = await prisma
    .$transaction((tx) =>
      createCategorySaleExpense(tx, {
        organizationId: context.organizationId,
        gymMemberId,
        category,
        createdById: context.userId,
        quantity: 1,
        channel: 'pos',
      }),
    )
    .catch((error: unknown) => {
      return { error: error instanceof Error ? error.message : 'Satış kaydı oluşturulamadı.' } as const;
    });

  if (expense && 'error' in expense) {
    return { error: expense.error };
  }

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { gymMemberId, categoryId, quick: true, stockDecremented: category.stockQuantity != null },
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

  const paymentMethod = parsed.data.paymentMethod as PaymentMethod;
  const shiftResolution = await resolveCashShiftForPayment(context.organizationId, paymentMethod);
  if (shiftResolution.error) {
    return { error: shiftResolution.error };
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
        paymentMethod,
        cashRegisterShiftId: shiftResolution.shiftId,
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

    const invoiceFlags = formData.getAll('issueInvoice');
    const shouldIssueInvoice =
      invoiceFlags.includes('1') ||
      (invoiceFlags.length === 0 && !formData.has('issueInvoice'));

    if (shouldIssueInvoice) {
      const invoice = await issueInvoiceFromPayment(
        {
          organizationId: context.organizationId,
          gymMemberId: parsed.data.gymMemberId,
          amount: parsed.data.amount,
          currency,
          expenseId: parsed.data.expenseId,
          notes: parsed.data.notes ?? undefined,
          issuedById: context.userId,
        },
        tx,
      );

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { invoiceId: invoice.id },
      });
    }

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
  revalidatePath('/dashboard/pos/shifts');

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
  const refundPaymentMethod = (parsed.data.paymentMethod ??
    original.paymentMethod) as PaymentMethod;
  const shiftResolution = await resolveCashShiftForPayment(
    context.organizationId,
    refundPaymentMethod,
    'refund',
  );
  if (shiftResolution.error) {
    return { error: shiftResolution.error };
  }

  await prisma.$transaction(async (tx) => {
    const refund = await tx.transaction.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: original.gymMemberId,
        expenseId: original.expenseId,
        amount: parsed.data.amount,
        currency,
        type: 'REFUND',
        paymentMethod: refundPaymentMethod,
        cashRegisterShiftId: shiftResolution.shiftId,
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
  revalidatePath('/dashboard/pos/shifts');
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
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
  isStoreVisible: z.boolean().optional(),
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
    stockQuantity:
      formData.get('stockQuantity') === '' || formData.get('stockQuantity') == null
        ? undefined
        : formData.get('stockQuantity'),
    lowStockThreshold:
      formData.get('lowStockThreshold') === '' || formData.get('lowStockThreshold') == null
        ? undefined
        : formData.get('lowStockThreshold'),
    isStoreVisible: formData.get('isStoreVisible') === 'on',
  });

  if (!parsed.success) {
    return { error: 'Geçersiz kategori verisi.' };
  }

  const { categoryId, name, defaultAmount, sortOrder, stockQuantity, lowStockThreshold, isStoreVisible } =
    parsed.data;

  if (isStoreVisible && defaultAmount == null) {
    return { error: 'Mağazaya eklemeden önce bir fiyat belirleyin.' };
  }

  const stockData = {
    stockQuantity: stockQuantity ?? null,
    lowStockThreshold: lowStockThreshold ?? null,
  };

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
        isStoreVisible: isStoreVisible ?? false,
        ...stockData,
      },
    });
  } else {
    await prisma.expenseCategory.create({
      data: {
        organizationId: session.user.organizationId,
        name,
        defaultAmount: defaultAmount ?? null,
        sortOrder: sortOrder ?? 0,
        isStoreVisible: isStoreVisible ?? false,
        ...stockData,
      },
    });
  }

  revalidatePath('/dashboard/pos');
  return { success: 'Kategori kaydedildi.' };
}

export async function setExpenseCategoryStoreVisible(
  categoryId: string,
  isStoreVisible: boolean,
): Promise<ExpenseActionState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' };
  }

  const role = session.user.role;
  if (!role || !new Set<OrganizationRole>(['OWNER', 'ADMIN']).has(role)) {
    return { error: 'Kategori yönetimi için OWNER veya ADMIN yetkisi gerekir.' };
  }

  if (isStoreVisible) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: categoryId, organizationId: session.user.organizationId },
      select: { defaultAmount: true },
    });
    if (category?.defaultAmount == null) {
      return { error: 'Mağazaya eklemeden önce bir fiyat belirleyin.' };
    }
  }

  await prisma.expenseCategory.updateMany({
    where: { id: categoryId, organizationId: session.user.organizationId },
    data: { isStoreVisible },
  });

  revalidatePath('/dashboard/pos');
  return {
    success: isStoreVisible ? 'Kategori mağazada gösterilecek.' : 'Kategori mağazadan kaldırıldı.',
  };
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

/**
 * Faz 40 — resepsiyon, mobil mağazadan sipariş verilmiş bir ürünü sporcuya
 * elden teslim ettiğinde çağrılır. `deliveredAt` doldurulunca sipariş
 * "Bekleyen Teslimatlar" kuyruğundan çıkar.
 */
export async function markStoreOrderDelivered(expenseId: string): Promise<ExpenseActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, organizationId: context.organizationId, deliveredAt: null },
  });

  if (!expense) {
    return { error: 'Sipariş bulunamadı veya zaten teslim edilmiş.' };
  }

  await prisma.expense.update({
    where: { id: expense.id },
    data: { deliveredAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: expense.id,
      metadata: { kind: 'store_order_delivered', gymMemberId: expense.gymMemberId },
    },
  });

  revalidatePath('/dashboard/pos');
  return { success: 'Sipariş teslim edildi olarak işaretlendi.' };
}

/**
 * Faz 40 — resepsiyona yeni ürün geldiğinde (ör. bir kasa su) stok sayacını
 * artırmak için. Kategori yönetiminin aksine OWNER/ADMIN/STAFF hepsi
 * kullanabilir — bu idari bir fiyat/görünürlük kararı değil, günlük bir
 * operasyon (patron yokken kasiyer de gelen malı sisteme işleyebilmeli).
 * `stockQuantity` NULL (stok takibi hiç başlamamış) olsa bile doğru çalışır
 * — COALESCE ile 0'dan başlatılır. Aynı anda bir satışın azaltma işlemiyle
 * çakışmaması için veritabanı seviyesinde atomik `UPDATE ... SET x = x + N`
 * kullanılır, "oku-hesapla-yaz" yapılmaz.
 */
export async function restockExpenseCategory(
  categoryId: string,
  quantity: number,
): Promise<ExpenseActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100_000) {
    return { error: 'Geçersiz miktar.' };
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, organizationId: context.organizationId },
    select: { id: true, name: true },
  });
  if (!category) {
    return { error: 'Kategori bulunamadı.' };
  }

  await prisma.$executeRaw`
    UPDATE expense_categories
    SET stock_quantity = COALESCE(stock_quantity, 0) + ${quantity}
    WHERE id = ${categoryId} AND organization_id = ${context.organizationId}
  `;

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'EXPENSE_ADDED',
      entityType: 'expense_category',
      entityId: category.id,
      metadata: { kind: 'store_restock', quantity },
    },
  });

  revalidatePath('/dashboard/pos');
  return { success: `"${category.name}" stoğuna ${quantity} adet eklendi.` };
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
