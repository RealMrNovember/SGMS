'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import {
  buildShiftReportSnapshot,
  roundMoney,
  type ShiftReportSnapshot,
} from '@/lib/cash-register/report';
import { decimalToNumber } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { PaymentMethod, Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type CashRegisterActionState = {
  error?: string;
  success?: string;
  report?: ShiftReportSnapshot;
};

export type { ShiftReportSnapshot, ShiftReportByMethod } from '@/lib/cash-register/report';

async function getStaffContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }
  const organizationId = session.user.organizationId;
  const role = session.user.role;
  if (!organizationId || !role || !MANAGER_ROLES.has(role)) {
    return { error: 'Bu işlem için OWNER, ADMIN veya STAFF yetkisi gerekir.' as const };
  }
  return { organizationId, actorId: session.user.id };
}

export async function getOpenCashShift(organizationId: string) {
  return prisma.cashRegisterShift.findFirst({
    where: { organizationId, closedAt: null },
    orderBy: { openedAt: 'desc' },
    include: {
      openedBy: { select: { id: true, name: true } },
    },
  });
}

export async function resolveCashShiftForPayment(
  organizationId: string,
  paymentMethod: PaymentMethod,
  kind: 'payment' | 'refund' = 'payment',
): Promise<{ error?: string; shiftId: string | null }> {
  const openShift = await getOpenCashShift(organizationId);

  if (paymentMethod === 'CASH') {
    if (!openShift) {
      const verb = kind === 'refund' ? 'iade' : 'tahsilat';
      return {
        error: `Nakit ${verb} için açık kasa vardiyası gerekir. Önce vardiya açın veya kart/havale kullanın.`,
        shiftId: null,
      };
    }
    return { shiftId: openShift.id };
  }

  return { shiftId: openShift?.id ?? null };
}

const openShiftSchema = z.object({
  openingBalance: z.coerce.number().min(0).max(10_000_000),
});

export async function openCashShift(
  _prev: CashRegisterActionState,
  formData: FormData,
): Promise<CashRegisterActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = openShiftSchema.safeParse({
    openingBalance: formData.get('openingBalance'),
  });
  if (!parsed.success) {
    return { error: 'Geçersiz açılış bakiyesi.' };
  }

  const existing = await getOpenCashShift(context.organizationId);
  if (existing) {
    return { error: 'Zaten açık bir kasa vardiyası var. Önce mevcut vardiyayı kapatın.' };
  }

  const shift = await prisma.cashRegisterShift.create({
    data: {
      organizationId: context.organizationId,
      openedById: context.actorId,
      openingBalance: parsed.data.openingBalance,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'CASH_SHIFT_OPENED',
      entityType: 'cash_register_shift',
      entityId: shift.id,
      metadata: { openingBalance: parsed.data.openingBalance },
    },
  });

  revalidatePath('/dashboard/pos');
  revalidatePath('/dashboard/pos/shifts');

  return { success: 'Kasa vardiyası açıldı.' };
}

const closeShiftSchema = z.object({
  closingBalanceCounted: z.coerce.number().min(0).max(10_000_000),
  notes: z.string().max(1000).optional(),
});

export async function closeCashShift(
  _prev: CashRegisterActionState,
  formData: FormData,
): Promise<CashRegisterActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = closeShiftSchema.safeParse({
    closingBalanceCounted: formData.get('closingBalanceCounted'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Geçersiz kapanış sayım tutarı.' };
  }

  const openShift = await getOpenCashShift(context.organizationId);
  if (!openShift) {
    return { error: 'Kapatılacak açık kasa vardiyası bulunamadı.' };
  }

  const transactions = await prisma.transaction.findMany({
    where: { cashRegisterShiftId: openShift.id },
    select: { amount: true, type: true, paymentMethod: true },
  });

  const openingBalance = decimalToNumber(openShift.openingBalance);
  const reportSnapshot = buildShiftReportSnapshot(openingBalance, transactions, {
    closingBalanceCounted: parsed.data.closingBalanceCounted,
  });

  const closingBalanceExpected = reportSnapshot.closingBalanceExpected!;
  const discrepancy = roundMoney(parsed.data.closingBalanceCounted - closingBalanceExpected);

  reportSnapshot.closingBalanceExpected = closingBalanceExpected;
  reportSnapshot.discrepancy = discrepancy;

  await prisma.cashRegisterShift.update({
    where: { id: openShift.id },
    data: {
      closedById: context.actorId,
      closedAt: new Date(),
      closingBalanceExpected,
      closingBalanceCounted: parsed.data.closingBalanceCounted,
      discrepancy,
      notes: parsed.data.notes?.trim() || null,
      reportSnapshot: reportSnapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'CASH_SHIFT_CLOSED',
      entityType: 'cash_register_shift',
      entityId: openShift.id,
      metadata: {
        closingBalanceExpected,
        closingBalanceCounted: parsed.data.closingBalanceCounted,
        discrepancy,
      },
    },
  });

  revalidatePath('/dashboard/pos');
  revalidatePath('/dashboard/pos/shifts');

  const discrepancyNote =
    Math.abs(discrepancy) > 0.009
      ? ` Fark: ${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(2)} TRY.`
      : '';

  return {
    success: `Kasa vardiyası kapatıldı (Z raporu kaydedildi).${discrepancyNote}`,
    report: reportSnapshot,
  };
}

export async function buildXReport(shiftId: string): Promise<CashRegisterActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const shift = await prisma.cashRegisterShift.findFirst({
    where: { id: shiftId, organizationId: context.organizationId },
  });

  if (!shift) {
    return { error: 'Vardiya bulunamadı.' };
  }

  const transactions = await prisma.transaction.findMany({
    where: { cashRegisterShiftId: shift.id },
    select: { amount: true, type: true, paymentMethod: true },
  });

  const report = buildShiftReportSnapshot(decimalToNumber(shift.openingBalance), transactions);

  await prisma.auditLog.create({
    data: {
      actorId: context.actorId,
      organizationId: context.organizationId,
      action: 'CASH_X_REPORT',
      entityType: 'cash_register_shift',
      entityId: shift.id,
      metadata: { transactionCount: report.transactionCount },
    },
  });

  return { success: 'X raporu oluşturuldu.', report };
}
