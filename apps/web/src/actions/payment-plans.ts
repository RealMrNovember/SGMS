'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { getExpenseContext } from '@/actions/expenses';
import { VOID_ROLES } from '@/lib/billing/roles';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type PaymentPlanActionState = {
  error?: string;
  success?: string;
};

const cadenceSchema = z.object({
  gymMemberId: z.string().cuid(),
  totalAmount: z.coerce.number().positive().max(1_000_000),
  installmentCount: z.coerce.number().int().min(1).max(24),
  firstDueDate: z.coerce.date(),
  cadence: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM_DAYS']),
  intervalDays: z.coerce.number().int().min(1).max(90).optional(),
  description: z.string().max(200).optional(),
});

function addCadenceStep(date: Date, cadence: 'WEEKLY' | 'MONTHLY' | 'CUSTOM_DAYS', intervalDays?: number) {
  const next = new Date(date);
  if (cadence === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
  } else if (cadence === 'MONTHLY') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + (intervalDays ?? 30));
  }
  return next;
}

/** Toplamı taksitlere eşit böler, küsurat son taksite eklenir (toplam tam eşitlenir). */
function splitInstallments(totalAmount: number, installmentCount: number): number[] {
  const base = Math.floor((totalAmount / installmentCount) * 100) / 100;
  const amounts = new Array(installmentCount).fill(base);
  const distributed = base * (installmentCount - 1);
  amounts[installmentCount - 1] = Math.round((totalAmount - distributed) * 100) / 100;
  return amounts;
}

export async function createPaymentPlan(
  _prev: PaymentPlanActionState,
  formData: FormData,
): Promise<PaymentPlanActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = cadenceSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    totalAmount: formData.get('totalAmount'),
    installmentCount: formData.get('installmentCount'),
    firstDueDate: formData.get('firstDueDate'),
    cadence: formData.get('cadence'),
    intervalDays: formData.get('intervalDays') || undefined,
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz ödeme planı verisi.' };
  }

  const { gymMemberId, totalAmount, installmentCount, firstDueDate, cadence, intervalDays, description } =
    parsed.data;

  if (cadence === 'CUSTOM_DAYS' && !intervalDays) {
    return { error: 'Özel gün aralığı için gün sayısı gerekli.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  const installmentAmounts = splitInstallments(totalAmount, installmentCount);

  await prisma.$transaction(async (tx) => {
    const createdPlan = await tx.paymentPlan.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId,
        description: description ?? null,
        installmentCount,
        status: 'ACTIVE',
        createdById: context.userId,
      },
    });

    let dueDate = firstDueDate;
    for (let i = 0; i < installmentCount; i += 1) {
      await tx.expense.create({
        data: {
          organizationId: context.organizationId,
          gymMemberId,
          paymentPlanId: createdPlan.id,
          amount: installmentAmounts[i],
          currency: 'TRY',
          description: `${description ?? 'Ödeme planı'} — Taksit ${i + 1}/${installmentCount}`,
          status: 'OPEN',
          dueDate,
          createdById: context.userId,
        },
      });
      dueDate = addCadenceStep(dueDate, cadence, intervalDays);
    }

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'PAYMENT_PLAN_CREATED',
        entityType: 'payment_plan',
        entityId: createdPlan.id,
        metadata: { gymMemberId, installmentCount, totalAmount },
      },
    });
  });

  revalidatePath(`/dashboard/members/${gymMemberId}`);
  revalidatePath('/dashboard/payment-plans');
  revalidatePath('/athlete/account');

  return { success: `${installmentCount} taksitli ödeme planı oluşturuldu.` };
}

export async function cancelPaymentPlan(paymentPlanId: string): Promise<PaymentPlanActionState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: 'Yetkisiz.' };
  }

  const role = session.user.role;
  if (!role || !VOID_ROLES.has(role)) {
    return { error: 'Ödeme planı iptali için OWNER veya ADMIN yetkisi gerekir.' };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id;

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const plan = await prisma.paymentPlan.findFirst({
    where: { id: paymentPlanId, organizationId },
  });

  if (!plan) {
    return { error: 'Ödeme planı bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.updateMany({
      where: { paymentPlanId, status: 'OPEN' },
      data: { status: 'VOID', voidedAt: new Date() },
    });

    await tx.paymentPlan.update({
      where: { id: paymentPlanId },
      data: { status: 'CANCELLED' },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        organizationId,
        action: 'PAYMENT_PLAN_CANCELLED',
        entityType: 'payment_plan',
        entityId: paymentPlanId,
        metadata: { gymMemberId: plan.gymMemberId },
      },
    });
  });

  revalidatePath(`/dashboard/members/${plan.gymMemberId}`);
  revalidatePath('/dashboard/payment-plans');
  revalidatePath('/athlete/account');

  return { success: 'Ödeme planı iptal edildi.' };
}

export async function updateInstallmentDueDate(
  expenseId: string,
  dueDate: string,
): Promise<PaymentPlanActionState> {
  const context = await getExpenseContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsedDate = new Date(dueDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: 'Geçersiz tarih.' };
  }

  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      organizationId: context.organizationId,
      status: 'OPEN',
      paymentPlanId: { not: null },
    },
  });

  if (!expense) {
    return { error: 'Taksit bulunamadı.' };
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: { dueDate: parsedDate },
  });

  revalidatePath(`/dashboard/members/${expense.gymMemberId}`);
  revalidatePath('/dashboard/payment-plans');

  return { success: 'Taksit vadesi güncellendi.' };
}
