'use server';

import { auth } from '@/lib/auth';
import { applyPaymentToExpenses } from '@/lib/billing/settle-payment';
import { MANAGER_ROLES, VOID_ROLES } from '@/lib/billing/roles';
import { computeManualExtension, computeRenewalPeriod } from '@/lib/membership/dates';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { OrganizationRole, PaymentMethod } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type MembershipActionState = {
  error?: string;
  success?: string;
};

async function getMembershipContext(allowed: ReadonlySet<OrganizationRole>) {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const userId = session.user.id;

  if (!organizationId || !role || !allowed.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }

  return { organizationId, role, userId };
}

const renewSchema = z.object({
  gymMemberId: z.string().cuid(),
  planId: z.string().cuid(),
  paymentMode: z.enum(['charge_open', 'pay_now']),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Paket satışı + üyelik süresi uzatma.
 * OWNER/ADMIN/STAFF — STAFF yalnızca satış yapabilir (ücretsiz uzatma bu aksiyonda yok).
 */
export async function renewMembership(
  _prev: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const context = await getMembershipContext(MANAGER_ROLES);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = renewSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    planId: formData.get('planId'),
    paymentMode: formData.get('paymentMode') ?? 'charge_open',
    paymentMethod: formData.get('paymentMethod') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Lütfen plan ve ödeme seçeneklerini kontrol edin.' };
  }

  if (parsed.data.paymentMode === 'pay_now' && !parsed.data.paymentMethod) {
    return { error: 'Peşin tahsilat için ödeme yöntemi seçin.' };
  }

  const [member, plan] = await Promise.all([
    prisma.gymMember.findFirst({
      where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
    }),
    prisma.gymMembershipPlan.findFirst({
      where: {
        id: parsed.data.planId,
        organizationId: context.organizationId,
        isActive: true,
      },
    }),
  ]);

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }
  if (!plan) {
    return { error: 'Geçerli bir üyelik paketi seçin.' };
  }

  // Pasiften reaktivasyon plan limitine tabi
  if (member.status === 'INACTIVE') {
    const limitError = await assertWithinMemberLimit(context.organizationId);
    if (limitError) {
      return { error: limitError };
    }
  }

  const period = computeRenewalPeriod({
    currentEndsAt: member.membershipEndsAt,
    durationDays: plan.durationDays,
  });

  const planPrice = Number(plan.price.toString());
  const currency = plan.currency || 'TRY';
  const description =
    parsed.data.notes?.trim() ||
    `Üyelik yenileme: ${plan.name} (${plan.durationDays} gün)`;

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: {
        planId: plan.id,
        status: 'ACTIVE',
        ...(period.periodStartsAt ? { membershipStartsAt: period.periodStartsAt } : {}),
        membershipEndsAt: period.membershipEndsAt,
        lastReminderSentAt: null,
      },
    });

    const expense = await tx.expense.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: member.id,
        amount: planPrice,
        currency,
        description,
        status: 'OPEN',
        dueDate: period.membershipEndsAt,
        createdById: context.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'EXPENSE_ADDED',
        entityType: 'expense',
        entityId: expense.id,
        metadata: {
          gymMemberId: member.id,
          amount: planPrice,
          currency,
          source: 'membership_renewal',
          planId: plan.id,
          planName: plan.name,
        },
      },
    });

    if (parsed.data.paymentMode === 'pay_now' && planPrice > 0) {
      const paymentMethod = parsed.data.paymentMethod as PaymentMethod;
      const transaction = await tx.transaction.create({
        data: {
          organizationId: context.organizationId,
          gymMemberId: member.id,
          expenseId: expense.id,
          amount: planPrice,
          currency,
          type: 'PAYMENT',
          paymentMethod,
          notes: description,
          createdById: context.userId,
        },
      });

      await applyPaymentToExpenses(tx, {
        organizationId: context.organizationId,
        gymMemberId: member.id,
        amount: planPrice,
        targetExpenseId: expense.id,
      });

      await tx.auditLog.create({
        data: {
          actorId: context.userId,
          organizationId: context.organizationId,
          action: 'PAYMENT_RECORDED',
          entityType: 'transaction',
          entityId: transaction.id,
          metadata: {
            gymMemberId: member.id,
            amount: planPrice,
            currency,
            source: 'membership_renewal',
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: {
          kind: 'membership_renewed',
          planId: plan.id,
          planName: plan.name,
          durationDays: plan.durationDays,
          previousEndsAt: member.membershipEndsAt?.toISOString() ?? null,
          newEndsAt: period.membershipEndsAt.toISOString(),
          stacked: period.stacked,
          paymentMode: parsed.data.paymentMode,
          amount: planPrice,
          currency,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/dashboard/members');
  revalidatePath('/dashboard/pos');
  revalidatePath('/athlete');

  const endsLabel = period.membershipEndsAt.toLocaleDateString('tr-TR');
  if (parsed.data.paymentMode === 'pay_now') {
    return {
      success: `${plan.name} satıldı ve tahsil edildi. Yeni bitiş: ${endsLabel}.`,
    };
  }
  return {
    success: `${plan.name} satıldı (açık borç). Yeni bitiş: ${endsLabel}. Tahsilatı POS veya cari hesaptan alabilirsiniz.`,
  };
}

const extendSchema = z.object({
  gymMemberId: z.string().cuid(),
  extraDays: z.coerce.number().int().min(1).max(3650),
  reason: z.string().min(3).max(500),
});

/**
 * Ücretsiz / manuel süre uzatma — yalnızca OWNER/ADMIN (STAFF kapalı).
 */
export async function extendMembershipManually(
  _prev: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const context = await getMembershipContext(VOID_ROLES);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = extendSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    extraDays: formData.get('extraDays'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: 'Gün sayısı (1–3650) ve gerekçe zorunludur.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  if (member.status === 'INACTIVE') {
    const limitError = await assertWithinMemberLimit(context.organizationId);
    if (limitError) {
      return { error: limitError };
    }
  }

  const extension = computeManualExtension({
    currentEndsAt: member.membershipEndsAt,
    extraDays: parsed.data.extraDays,
  });

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: {
        status: 'ACTIVE',
        ...(!member.membershipStartsAt || !extension.stacked
          ? { membershipStartsAt: member.membershipStartsAt ?? extension.baseDate }
          : {}),
        membershipEndsAt: extension.membershipEndsAt,
        lastReminderSentAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.userId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: {
          kind: 'membership_extended_manual',
          extraDays: parsed.data.extraDays,
          reason: parsed.data.reason.trim(),
          previousEndsAt: member.membershipEndsAt?.toISOString() ?? null,
          newEndsAt: extension.membershipEndsAt.toISOString(),
          stacked: extension.stacked,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/dashboard/members');
  revalidatePath('/athlete');

  return {
    success: `Üyelik ${parsed.data.extraDays} gün uzatıldı. Yeni bitiş: ${extension.membershipEndsAt.toLocaleDateString('tr-TR')}.`,
  };
}
