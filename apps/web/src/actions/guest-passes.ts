'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { issueGuestPassQrToken } from '@/lib/check-in/guest-qr';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type GuestPassActionState = {
  error?: string;
  success?: string;
  token?: string;
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

const issueSchema = z.object({
  guestName: z.string().min(2).max(120),
  guestPhone: z.string().max(30).optional(),
  hostMemberId: z.string().cuid().optional(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export async function issueGuestPass(
  _prev: GuestPassActionState,
  formData: FormData,
): Promise<GuestPassActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = issueSchema.safeParse({
    guestName: formData.get('guestName'),
    guestPhone: formData.get('guestPhone') || undefined,
    hostMemberId: formData.get('hostMemberId') || undefined,
    validFrom: formData.get('validFrom'),
    validUntil: formData.get('validUntil'),
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Misafir kartı bilgilerini kontrol edin.' };
  }

  const validFrom = new Date(parsed.data.validFrom);
  const validUntil = new Date(parsed.data.validUntil);
  if (validUntil <= validFrom) {
    return { error: 'Geçerlilik bitişi başlangıçtan sonra olmalı.' };
  }

  if (parsed.data.hostMemberId) {
    const host = await prisma.gymMember.findFirst({
      where: { id: parsed.data.hostMemberId, organizationId: context.organizationId },
    });
    if (!host) {
      return { error: 'Referans üye bulunamadı.' };
    }
  }

  const placeholderHash = createHash('sha256').update(randomBytes(32)).digest('hex');

  const pass = await prisma.guestPass.create({
    data: {
      organizationId: context.organizationId,
      guestName: parsed.data.guestName.trim(),
      guestPhone: parsed.data.guestPhone?.trim() || null,
      hostMemberId: parsed.data.hostMemberId ?? null,
      issuedById: context.actorId,
      validFrom,
      validUntil,
      notes: parsed.data.notes?.trim() || null,
      qrTokenHash: placeholderHash,
    },
  });

  const { token, tokenHash } = issueGuestPassQrToken(context.organizationId, pass.id, validUntil);

  await prisma.$transaction(async (tx) => {
    await tx.guestPass.update({
      where: { id: pass.id },
      data: { qrTokenHash: tokenHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'GUEST_PASS_ISSUED',
        entityType: 'guest_pass',
        entityId: pass.id,
        metadata: { guestName: pass.guestName, validUntil: validUntil.toISOString() },
      },
    });
  });

  revalidatePath('/dashboard/guest-passes');
  return {
    success: `${parsed.data.guestName} için misafir kartı oluşturuldu. QR kodu yalnızca bir kez gösterilir.`,
    token,
  };
}

export async function revokeGuestPass(passId: string): Promise<GuestPassActionState> {
  const context = await getStaffContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const pass = await prisma.guestPass.findFirst({
    where: { id: passId, organizationId: context.organizationId, revokedAt: null },
  });
  if (!pass) {
    return { error: 'Misafir kartı bulunamadı veya zaten iptal.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.guestPass.update({
      where: { id: pass.id },
      data: { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'GUEST_PASS_REVOKED',
        entityType: 'guest_pass',
        entityId: pass.id,
        metadata: { guestName: pass.guestName },
      },
    });
  });

  revalidatePath('/dashboard/guest-passes');
  return { success: 'Misafir kartı iptal edildi.' };
}
