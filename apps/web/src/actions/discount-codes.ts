'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { DiscountType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type DiscountActionState = {
  error?: string;
  success?: string;
};

export type DiscountApplyResult =
  | { ok: true; amountSaved: number; finalAmount: number; discountCodeId: string }
  | { ok: false; error: string };

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

const DISCOUNT_TYPES = ['FIXED', 'PERCENT'] as const satisfies readonly DiscountType[];

const createSchema = z.object({
  code: z.string().min(3).max(40).transform((v) => v.toUpperCase()),
  type: z.enum(DISCOUNT_TYPES),
  value: z.coerce.number().positive().max(1_000_000),
  maxUses: z.coerce.number().int().positive().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function createDiscountCode(
  _prev: DiscountActionState,
  formData: FormData,
): Promise<DiscountActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = createSchema.safeParse({
    code: formData.get('code'),
    type: formData.get('type') ?? 'PERCENT',
    value: formData.get('value'),
    maxUses: formData.get('maxUses') || undefined,
    validFrom: formData.get('validFrom') || undefined,
    validUntil: formData.get('validUntil') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Kupon bilgilerini kontrol edin.' };
  }

  if (parsed.data.type === 'PERCENT' && parsed.data.value > 100) {
    return { error: 'Yüzde indirim en fazla 100 olabilir.' };
  }

  const existing = await prisma.discountCode.findFirst({
    where: { organizationId: context.organizationId, code: parsed.data.code },
  });
  if (existing) {
    return { error: 'Bu kod zaten tanımlı.' };
  }

  const code = await prisma.$transaction(async (tx) => {
    const created = await tx.discountCode.create({
      data: {
        organizationId: context.organizationId,
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
        maxUses: parsed.data.maxUses ?? null,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
        notes: parsed.data.notes?.trim() || null,
        createdById: context.actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'DISCOUNT_CODE_CREATED',
        entityType: 'discount_code',
        entityId: created.id,
        metadata: { code: created.code, type: created.type, value: Number(created.value) },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/discounts');
  return { success: `Kupon "${code.code}" oluşturuldu.` };
}

export async function validateAndApplyDiscountCode(
  code: string,
  baseAmount: number,
  organizationId?: string,
): Promise<DiscountApplyResult> {
  const session = await auth();
  const orgId = organizationId ?? session?.user?.organizationId;
  if (!orgId) {
    return { ok: false, error: 'Organizasyon bulunamadı.' };
  }

  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { ok: false, error: 'Geçersiz tutar.' };
  }

  const normalized = code.trim().toUpperCase();
  const discount = await prisma.discountCode.findFirst({
    where: { organizationId: orgId, code: normalized, isActive: true },
  });

  if (!discount) {
    return { ok: false, error: 'Kupon bulunamadı veya pasif.' };
  }

  const now = new Date();
  if (discount.validFrom && discount.validFrom > now) {
    return { ok: false, error: 'Kupon henüz geçerli değil.' };
  }
  if (discount.validUntil && discount.validUntil < now) {
    return { ok: false, error: 'Kupon süresi dolmuş.' };
  }
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
    return { ok: false, error: 'Kupon kullanım limiti dolmuş.' };
  }

  const value = Number(discount.value.toString());
  let amountSaved =
    discount.type === 'PERCENT' ? Math.round((baseAmount * value) / 100 * 100) / 100 : value;
  amountSaved = Math.min(amountSaved, baseAmount);
  const finalAmount = Math.max(0, Math.round((baseAmount - amountSaved) * 100) / 100);

  return { ok: true, amountSaved, finalAmount, discountCodeId: discount.id };
}

export async function redeemDiscountCode(
  discountCodeId: string,
  amountSaved: number,
  context?: string,
  gymMemberId?: string,
): Promise<DiscountActionState> {
  const staff = await getStaffContext();
  if ('error' in staff) {
    return { error: staff.error };
  }

  const writeBlock = await getTenantWriteBlockReason(staff.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const discount = await prisma.discountCode.findFirst({
    where: { id: discountCodeId, organizationId: staff.organizationId, isActive: true },
  });
  if (!discount) {
    return { error: 'Kupon bulunamadı.' };
  }

  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
    return { error: 'Kupon kullanım limiti dolmuş.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.discountCode.update({
      where: { id: discount.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.discountRedemption.create({
      data: {
        organizationId: staff.organizationId,
        discountCodeId: discount.id,
        gymMemberId: gymMemberId ?? null,
        amountSaved,
        context: context ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: staff.actorId,
        organizationId: staff.organizationId,
        action: 'DISCOUNT_CODE_REDEEMED',
        entityType: 'discount_code',
        entityId: discount.id,
        metadata: { amountSaved, gymMemberId: gymMemberId ?? null },
      },
    });
  });

  revalidatePath('/dashboard/discounts');
  return { success: 'Kupon kullanıldı.' };
}
