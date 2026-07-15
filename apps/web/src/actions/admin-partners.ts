'use server';

import { requireSuperAdmin } from '@/lib/admin/guards';
import { slugify } from '@/lib/slug';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AdminPartnerActionState = {
  error?: string;
  success?: string;
  generatedPassword?: string;
};

function revalidatePartnerAdminViews(partnerId?: string) {
  revalidatePath('/admin/partners');
  if (partnerId) revalidatePath(`/admin/partners/${partnerId}`);
}

function randomPassword(): string {
  return `Cb${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}!`;
}

const createPartnerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

/** Senaryo: Enes ÖZKARCI şirkete katılan yeni bir referans temsilcisi — Master Admin
 * onu buradan sisteme ekler, kendisine giriş bilgileri (tek seferlik) gösterilir. */
export async function createPartner(
  _prev: AdminPartnerActionState,
  formData: FormData,
): Promise<AdminPartnerActionState> {
  const parsed = createPartnerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    commissionRate: formData.get('commissionRate') || undefined,
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Lütfen ad ve geçerli bir e-posta adresi girin.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { name, email, commissionRate, notes } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { error: 'Bu e-posta adresi zaten kayıtlı.' };
    }

    let code = slugify(name).toUpperCase().replace(/-/g, '').slice(0, 10) || 'PARTNER';
    const codeExists = await prisma.partner.findUnique({ where: { code } });
    if (codeExists) {
      code = `${code}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }

    const password = randomPassword();
    const passwordHash = await hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          status: 'ACTIVE',
          isPartner: true,
          locale: 'tr',
        },
      });

      const createdPartner = await tx.partner.create({
        data: {
          userId: user.id,
          name,
          code,
          commissionRate: commissionRate ?? 0,
          notes: notes || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'PARTNER_CREATED',
          entityType: 'partner',
          entityId: createdPartner.id,
          metadata: { name, email: normalizedEmail, code, source: 'master_admin' },
        },
      });

      return createdPartner;
    });

    revalidatePartnerAdminViews();
    return {
      success: `Temsilci "${name}" oluşturuldu (kod: ${code}). Giriş bilgilerini şimdi kendisine iletin — tekrar gösterilmeyecek.`,
      generatedPassword: password,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Temsilci oluşturulamadı.' };
  }
}

const assignPartnerSchema = z.object({
  organizationId: z.string().cuid(),
  partnerId: z.string().cuid().optional().or(z.literal('')),
});

/** Senaryo: Bir müşteri kayıt formunda "beni yönlendiren" alanına Enes'in adını yazdı —
 * Master Admin bunu doğrulayıp organizasyonu gerçek Partner kaydıyla eşleştirir. */
export async function assignPartnerToOrganization(
  _prev: AdminPartnerActionState,
  formData: FormData,
): Promise<AdminPartnerActionState> {
  const parsed = assignPartnerSchema.safeParse({
    organizationId: formData.get('organizationId'),
    partnerId: formData.get('partnerId') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Geçersiz seçim.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { organizationId, partnerId } = parsed.data;
    const nextPartnerId = partnerId || null;

    if (nextPartnerId) {
      const partner = await prisma.partner.findUnique({ where: { id: nextPartnerId } });
      if (!partner || !partner.isActive) {
        return { error: 'Temsilci bulunamadı veya pasif.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { partnerId: nextPartnerId },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          organizationId,
          action: nextPartnerId ? 'PARTNER_ASSIGNED' : 'PARTNER_UNASSIGNED',
          entityType: 'organization',
          entityId: organizationId,
          metadata: { partnerId: nextPartnerId, source: 'master_admin' },
        },
      });
    });

    revalidatePath('/admin/organizations');
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePartnerAdminViews(nextPartnerId ?? undefined);
    return { success: nextPartnerId ? 'Temsilci bu organizasyona atandı.' : 'Temsilci ataması kaldırıldı.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Atama yapılamadı.' };
  }
}

const togglePartnerSchema = z.object({
  partnerId: z.string().cuid(),
  isActive: z.coerce.boolean(),
});

export async function setPartnerActive(
  _prev: AdminPartnerActionState,
  formData: FormData,
): Promise<AdminPartnerActionState> {
  const parsed = togglePartnerSchema.safeParse({
    partnerId: formData.get('partnerId'),
    isActive: formData.get('isActive') === 'true',
  });

  if (!parsed.success) {
    return { error: 'Geçersiz istek.' };
  }

  try {
    const session = await requireSuperAdmin();
    const { partnerId, isActive } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.partner.update({ where: { id: partnerId }, data: { isActive } });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'PARTNER_UPDATED',
          entityType: 'partner',
          entityId: partnerId,
          metadata: { isActive, source: 'master_admin' },
        },
      });
    });

    revalidatePartnerAdminViews(partnerId);
    return { success: isActive ? 'Temsilci etkinleştirildi.' : 'Temsilci pasifleştirildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Güncellenemedi.' };
  }
}
