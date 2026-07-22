'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { BusinessExpenseCategory, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export type BusinessExpenseState = {
  error?: string;
  success?: string;
};

const CATEGORIES = [
  'RENT',
  'UTILITIES',
  'SALARY',
  'SUPPLIES',
  'MARKETING',
  'OTHER',
] as const satisfies readonly BusinessExpenseCategory[];

const schema = z.object({
  category: z.enum(CATEGORIES),
  amount: z.coerce.number().positive().max(10_000_000),
  currency: z.string().min(3).max(3).default('TRY'),
  description: z.string().max(500).optional(),
  incurredAt: z.string().min(1),
});

export async function createBusinessExpense(
  _prev: BusinessExpenseState,
  formData: FormData,
): Promise<BusinessExpenseState> {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için OWNER/ADMIN yetkisi gerekir.' };
  }

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = schema.safeParse({
    category: formData.get('category'),
    amount: formData.get('amount'),
    currency: formData.get('currency') || 'TRY',
    description: formData.get('description') || undefined,
    incurredAt: formData.get('incurredAt'),
  });
  if (!parsed.success) {
    return { error: 'Gider formu geçersiz.' };
  }

  const incurredAt = new Date(parsed.data.incurredAt);
  if (Number.isNaN(incurredAt.getTime())) {
    return { error: 'Geçerli bir tarih girin.' };
  }

  await prisma.businessExpense.create({
    data: {
      organizationId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      currency: parsed.data.currency.toUpperCase(),
      description: parsed.data.description?.trim() || null,
      incurredAt,
      createdById: session.user.id,
    },
  });

  revalidatePath('/dashboard/reports');
  return { success: 'İşletme gideri kaydedildi.' };
}

export async function sumBusinessExpenses(
  organizationId: string,
  range: { start: Date; end: Date },
  currency = 'TRY',
): Promise<number> {
  const groups = await prisma.businessExpense.groupBy({
    by: ['currency'],
    where: {
      organizationId,
      incurredAt: { gte: range.start, lte: range.end },
      currency,
    },
    _sum: { amount: true },
  });
  const row = groups[0];
  return row?._sum.amount != null ? Number(row._sum.amount.toString()) : 0;
}
