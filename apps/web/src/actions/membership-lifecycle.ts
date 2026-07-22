'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { MembershipFreezeReason } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type LifecycleActionState = {
  error?: string;
  success?: string;
};

async function getStaffContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için yetkiniz yok.' as const };
  }
  return { organizationId, actorId: session.user.id };
}

async function getMemberOrStaffContext(gymMemberId?: string) {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için oturum gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId) {
    return { error: 'Organizasyon bulunamadı.' as const };
  }
  if (role && MANAGER_ROLES.has(role)) {
    return { organizationId, actorId: session.user.id, isStaff: true as const };
  }
  if (session.user.gymMemberId && (!gymMemberId || session.user.gymMemberId === gymMemberId)) {
    return {
      organizationId,
      actorId: session.user.id,
      isStaff: false as const,
      gymMemberId: session.user.gymMemberId,
    };
  }
  return { error: 'Bu işlem için yetkiniz yok.' as const };
}

function inclusiveDays(start: Date, end: Date): number {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

function remainingMembershipDays(endsAt: Date | null, from = new Date()): number {
  if (!endsAt || endsAt.getTime() <= from.getTime()) {
    return 0;
  }
  return Math.ceil((endsAt.getTime() - from.getTime()) / 86_400_000);
}

function stackMembershipEnd(currentEndsAt: Date | null, extraDays: number, from = new Date()): Date {
  const base =
    currentEndsAt && currentEndsAt.getTime() > from.getTime() ? currentEndsAt : from;
  const next = new Date(base);
  next.setDate(next.getDate() + extraDays);
  return next;
}

const FREEZE_REASONS = ['MILITARY', 'MEDICAL', 'TRAVEL', 'OTHER'] as const satisfies readonly MembershipFreezeReason[];

const freezeRequestSchema = z.object({
  gymMemberId: z.string().cuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.enum(FREEZE_REASONS),
  notes: z.string().max(1000).optional(),
});

export async function requestMembershipFreeze(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const gymMemberId = String(formData.get('gymMemberId') ?? '');
  const context = await getMemberOrStaffContext(gymMemberId);
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = freezeRequestSchema.safeParse({
    gymMemberId,
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    reason: formData.get('reason') ?? 'OTHER',
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Lütfen dondurma tarihlerini kontrol edin.' };
  }

  if (!context.isStaff && parsed.data.gymMemberId !== context.gymMemberId) {
    return { error: 'Yalnızca kendi üyeliğiniz için talep oluşturabilirsiniz.' };
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId, status: 'ACTIVE' },
  });
  if (!member) {
    return { error: 'Aktif üye bulunamadı.' };
  }

  const pending = await prisma.membershipFreeze.findFirst({
    where: { gymMemberId: member.id, status: 'PENDING' },
  });
  if (pending) {
    return { error: 'Bu üye için bekleyen bir dondurma talebi zaten var.' };
  }

  const freeze = await prisma.$transaction(async (tx) => {
    const created = await tx.membershipFreeze.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: member.id,
        startDate,
        endDate,
        reason: parsed.data.reason,
        notes: parsed.data.notes?.trim() || null,
        status: 'PENDING',
        requestedById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_FREEZE_REQUESTED',
        entityType: 'membership_freeze',
        entityId: created.id,
        metadata: { gymMemberId: member.id, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/athlete/account');
  return { success: `Dondurma talebi oluşturuldu (${freeze.id.slice(0, 8)}…).` };
}

export async function approveMembershipFreeze(freezeId: string): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const freeze = await prisma.membershipFreeze.findFirst({
    where: { id: freezeId, organizationId: context.organizationId, status: 'PENDING' },
    include: { gymMember: true },
  });
  if (!freeze) {
    return { error: 'Bekleyen dondurma talebi bulunamadı.' };
  }

  const days = inclusiveDays(freeze.startDate, freeze.endDate);

  await prisma.$transaction(async (tx) => {
    const member = freeze.gymMember;
    const extendedEnd = stackMembershipEnd(member.membershipEndsAt, days);

    await tx.gymMember.update({
      where: { id: member.id },
      data: { status: 'FROZEN', membershipEndsAt: extendedEnd },
    });

    await tx.membershipFreeze.update({
      where: { id: freeze.id },
      data: {
        status: 'APPROVED',
        approvedById: context.actorId,
        decidedAt: new Date(),
        daysExtended: days,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_FREEZE_APPROVED',
        entityType: 'membership_freeze',
        entityId: freeze.id,
        metadata: { gymMemberId: member.id, daysExtended: days },
      },
    });
  });

  revalidatePath(`/dashboard/members/${freeze.gymMemberId}`);
  revalidatePath('/athlete/account');
  return { success: 'Dondurma onaylandı; üyelik süresi uzatıldı.' };
}

export async function rejectMembershipFreeze(freezeId: string): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const freeze = await prisma.membershipFreeze.findFirst({
    where: { id: freezeId, organizationId: context.organizationId, status: 'PENDING' },
  });
  if (!freeze) {
    return { error: 'Bekleyen dondurma talebi bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membershipFreeze.update({
      where: { id: freeze.id },
      data: {
        status: 'REJECTED',
        approvedById: context.actorId,
        decidedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_FREEZE_REJECTED',
        entityType: 'membership_freeze',
        entityId: freeze.id,
        metadata: { gymMemberId: freeze.gymMemberId },
      },
    });
  });

  revalidatePath(`/dashboard/members/${freeze.gymMemberId}`);
  revalidatePath('/athlete/account');
  return { success: 'Dondurma talebi reddedildi.' };
}

export async function unfreezeMembership(gymMemberId: string): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId, status: 'FROZEN' },
  });
  if (!member) {
    return { error: 'Dondurulmuş üye bulunamadı.' };
  }

  const activeFreeze = await prisma.membershipFreeze.findFirst({
    where: { gymMemberId, organizationId: context.organizationId, status: 'APPROVED' },
    orderBy: { endDate: 'desc' },
  });

  const now = new Date();
  let clawedBackDays = 0;
  let nextEndsAt = member.membershipEndsAt;

  if (activeFreeze && activeFreeze.endDate > now) {
    // Erken çözme: approve sırasında tam dondurma süresi kadar uzatılmıştı;
    // kullanılmayan günleri membershipEndsAt'ten geri al.
    clawedBackDays = remainingMembershipDays(activeFreeze.endDate, now);
    if (clawedBackDays > 0 && nextEndsAt) {
      const adjusted = new Date(nextEndsAt);
      adjusted.setDate(adjusted.getDate() - clawedBackDays);
      // Üyelik bitişi "şimdi"nin altına düşmesin — en az bugün kalsın.
      nextEndsAt = adjusted.getTime() < now.getTime() ? now : adjusted;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: {
        status: 'ACTIVE',
        ...(nextEndsAt ? { membershipEndsAt: nextEndsAt } : {}),
      },
    });

    if (activeFreeze) {
      await tx.membershipFreeze.update({
        where: { id: activeFreeze.id },
        data: {
          // Erken çözüldüyse freeze kaydını "fiilen bitti" diye işaretle —
          // aynı APPROVED kaydı tekrar clawback tetiklemesin.
          endDate: now < activeFreeze.endDate ? now : activeFreeze.endDate,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: {
          kind: 'membership_unfrozen',
          clawedBackDays,
          previousEndsAt: member.membershipEndsAt?.toISOString() ?? null,
          newEndsAt: nextEndsAt?.toISOString() ?? null,
          freezeId: activeFreeze?.id ?? null,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${gymMemberId}`);
  revalidatePath('/athlete/account');
  if (clawedBackDays > 0) {
    return {
      success: `Üyelik tekrar aktif edildi. Kullanılmayan ${clawedBackDays} dondurma günü geri alındı.`,
    };
  }
  return { success: 'Üyelik tekrar aktif edildi.' };
}

const transferSchema = z.object({
  fromMemberId: z.string().cuid(),
  toMemberId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
  creditAmount: z.coerce.number().min(0).max(1_000_000).optional(),
});

export async function transferMembership(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = transferSchema.safeParse({
    fromMemberId: formData.get('fromMemberId'),
    toMemberId: formData.get('toMemberId'),
    notes: formData.get('notes') || undefined,
    creditAmount: formData.get('creditAmount') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Transfer formu geçersiz.' };
  }

  if (parsed.data.fromMemberId === parsed.data.toMemberId) {
    return { error: 'Kaynak ve hedef üye aynı olamaz.' };
  }

  const [fromMember, toMember] = await Promise.all([
    prisma.gymMember.findFirst({
      where: { id: parsed.data.fromMemberId, organizationId: context.organizationId },
    }),
    prisma.gymMember.findFirst({
      where: { id: parsed.data.toMemberId, organizationId: context.organizationId },
    }),
  ]);

  if (!fromMember || !toMember) {
    return { error: 'Üyelerden biri bulunamadı.' };
  }

  const now = new Date();
  const remainingDays = remainingMembershipDays(fromMember.membershipEndsAt, now);
  if (remainingDays <= 0 && !fromMember.planId) {
    return { error: 'Kaynak üyenin aktarılacak kalan hakkı yok.' };
  }

  const newToEnds = stackMembershipEnd(toMember.membershipEndsAt, remainingDays, now);

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: fromMember.id },
      data: { status: 'INACTIVE', planId: null, membershipEndsAt: now },
    });

    await tx.gymMember.update({
      where: { id: toMember.id },
      data: {
        status: 'ACTIVE',
        planId: fromMember.planId ?? toMember.planId,
        membershipEndsAt: newToEnds,
        membershipStartsAt: toMember.membershipStartsAt ?? now,
      },
    });

    await tx.membershipTransfer.create({
      data: {
        organizationId: context.organizationId,
        fromMemberId: fromMember.id,
        toMemberId: toMember.id,
        remainingDays,
        planId: fromMember.planId,
        notes: parsed.data.notes?.trim() || null,
        approvedById: context.actorId,
        creditAmount: parsed.data.creditAmount ?? null,
        creditCurrency: parsed.data.creditAmount ? 'TRY' : null,
      },
    });

    if (parsed.data.creditAmount && parsed.data.creditAmount > 0) {
      await tx.expense.create({
        data: {
          organizationId: context.organizationId,
          gymMemberId: fromMember.id,
          amount: parsed.data.creditAmount,
          currency: 'TRY',
          description: 'Kalan hak mahsubu',
          status: 'OPEN',
          createdById: context.actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_TRANSFER_COMPLETED',
        entityType: 'membership_transfer',
        entityId: fromMember.id,
        metadata: {
          fromMemberId: fromMember.id,
          toMemberId: toMember.id,
          remainingDays,
          creditAmount: parsed.data.creditAmount ?? null,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${fromMember.id}`);
  revalidatePath(`/dashboard/members/${toMember.id}`);
  return { success: 'Üyelik devri tamamlandı.' };
}

const creditSchema = z.object({
  gymMemberId: z.string().cuid(),
  creditAmount: z.coerce.number().positive().max(1_000_000),
  notes: z.string().max(500).optional(),
});

export async function creditRemainingRights(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = creditSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    creditAmount: formData.get('creditAmount'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Kredi tutarı geçersiz.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
  });
  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  const noteText =
    parsed.data.notes?.trim() ||
    'Kalan üyelik hakkı kredisi';

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        organizationId: context.organizationId,
        gymMemberId: member.id,
        amount: parsed.data.creditAmount,
        currency: 'TRY',
        type: 'ADJUSTMENT',
        paymentMethod: 'CASH',
        notes: noteText,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBERSHIP_RIGHTS_CREDITED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: { creditAmount: parsed.data.creditAmount },
      },
    });
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/athlete/account');
  return { success: 'Kalan hak kredisi kaydedildi.' };
}

const cancelSchema = z.object({
  gymMemberId: z.string().cuid(),
  refundAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: z.string().max(1000).optional(),
});

/** Üyeliği iptal eder (INACTIVE). Opsiyonel oranlı iade tutarı ADJUSTMENT olarak kaydedilir. */
export async function cancelMembership(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = cancelSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    refundAmount: formData.get('refundAmount') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'İptal formu geçersiz.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId: context.organizationId },
    include: { plan: { select: { name: true, price: true, durationDays: true, currency: true } } },
  });
  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }
  if (member.status === 'INACTIVE') {
    return { error: 'Üyelik zaten pasif.' };
  }

  const remainingDays = remainingMembershipDays(member.membershipEndsAt);
  const refundAmount = parsed.data.refundAmount ?? 0;
  const currency = member.plan?.currency || 'TRY';
  const noteText =
    parsed.data.notes?.trim() ||
    `Üyelik iptali${remainingDays > 0 ? ` (kalan ~${remainingDays} gün)` : ''}`;

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: { status: 'INACTIVE' },
    });

    if (refundAmount > 0) {
      await tx.transaction.create({
        data: {
          organizationId: context.organizationId,
          gymMemberId: member.id,
          amount: refundAmount,
          currency,
          type: 'ADJUSTMENT',
          paymentMethod: 'CASH',
          notes: `İptal iadesi / mahsup: ${noteText}`,
          createdById: context.actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: {
          kind: 'membership_cancelled',
          remainingDays,
          refundAmount,
          currency,
          planId: member.planId,
          previousStatus: member.status,
        },
      },
    });
  });

  revalidatePath(`/dashboard/members/${member.id}`);
  revalidatePath('/dashboard/members');
  revalidatePath('/athlete/account');
  return {
    success:
      refundAmount > 0
        ? `Üyelik iptal edildi. ${refundAmount.toFixed(2)} ${currency} mahsup/iade kaydı oluşturuldu.`
        : 'Üyelik iptal edildi (pasife alındı).',
  };
}

/** Oranlı iade önerisi: plan fiyatı × (kalan gün / paket süresi). */
export function suggestCancelRefund(params: {
  planPrice: number | null;
  durationDays: number | null;
  membershipEndsAt: Date | null;
  now?: Date;
}): number {
  const { planPrice, durationDays, membershipEndsAt, now = new Date() } = params;
  if (planPrice == null || !durationDays || durationDays <= 0 || !membershipEndsAt) {
    return 0;
  }
  const remaining = remainingMembershipDays(membershipEndsAt, now);
  if (remaining <= 0) {
    return 0;
  }
  return Math.round(planPrice * (Math.min(remaining, durationDays) / durationDays) * 100) / 100;
}

