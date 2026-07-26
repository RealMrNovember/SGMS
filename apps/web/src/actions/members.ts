'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { Gender, GymMemberStatus, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MEMBER_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);

const addGymMemberBaseSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  phone: z.string().min(10).max(20).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  planId: z.string().cuid().optional().or(z.literal('')),
  membershipStartsAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  isForeignMember: z.boolean(),
  nationalId: z.string().optional().or(z.literal('')),
  nationality: z.string().optional().or(z.literal('')),
  passportNumber: z.string().optional().or(z.literal('')),
});

export type AddGymMemberState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

async function getMemberManagerContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const actorRole = session.user.role;

  if (!organizationId || !actorRole || !MEMBER_MANAGER_ROLES.has(actorRole)) {
    return { error: 'Üye eklemek için OWNER, ADMIN veya STAFF yetkisi gerekir.' as const };
  }

  return {
    organizationId,
    actorId: session.user.id,
  };
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateMemberIdentity(data: z.infer<typeof addGymMemberBaseSchema>) {
  const fieldErrors: AddGymMemberState['fieldErrors'] = {};

  if (data.isForeignMember) {
    if (!data.nationality || data.nationality.length < 2) {
      fieldErrors.nationality = 'Ülke seçimi zorunludur.';
    }
    const passport = data.passportNumber?.trim();
    if (!passport || passport.length < 3) {
      fieldErrors.passportNumber = 'Pasaport numarası en az 3 karakter olmalıdır.';
    } else if (passport.length > 32) {
      fieldErrors.passportNumber = 'Pasaport numarası en fazla 32 karakter olabilir.';
    }
  } else if (data.nationalId && !/^\d{11}$/.test(data.nationalId)) {
    fieldErrors.nationalId = 'TC Kimlik No 11 haneli olmalıdır.';
  }

  return fieldErrors;
}

export async function addGymMember(
  _prevState: AddGymMemberState,
  formData: FormData,
): Promise<AddGymMemberState> {
  const context = await getMemberManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const isForeignMember = formData.get('isForeignMember') === 'on';

  const parsed = addGymMemberBaseSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    nationalId: isForeignMember ? '' : (formData.get('nationalId') ?? ''),
    nationality: isForeignMember ? (formData.get('nationality') ?? '') : '',
    passportNumber: isForeignMember ? (formData.get('passportNumber') ?? '') : '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    birthDate: formData.get('birthDate') ?? '',
    gender: formData.get('gender'),
    status: formData.get('status'),
    planId: formData.get('planId') ?? '',
    membershipStartsAt: formData.get('membershipStartsAt') ?? '',
    notes: formData.get('notes') ?? '',
    isForeignMember,
  });

  if (!parsed.success) {
    const fieldErrors: AddGymMemberState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const identityErrors = validateMemberIdentity(parsed.data);
  if (Object.keys(identityErrors).length > 0) {
    return { error: 'Lütfen kimlik alanlarını kontrol edin.', fieldErrors: identityErrors };
  }

  const data = parsed.data;
  const nationalId = !data.isForeignMember && data.nationalId ? data.nationalId : null;
  const nationality = data.isForeignMember ? data.nationality?.trim().toUpperCase() ?? null : null;
  const passportNumber = data.isForeignMember ? data.passportNumber?.trim().toUpperCase() ?? null : null;
  const email = data.email?.toLowerCase() || null;
  const phone = data.phone || null;
  const birthDate = parseOptionalDate(data.birthDate || undefined);
  const membershipStartsAt = parseOptionalDate(data.membershipStartsAt || undefined) ?? new Date();

  const [plan, nationalIdTaken, passportTaken, nationalityCountry] = await Promise.all([
    data.planId
      ? prisma.gymMembershipPlan.findFirst({
          where: {
            id: data.planId,
            organizationId: context.organizationId,
            isActive: true,
          },
        })
      : Promise.resolve(null),
    nationalId
      ? prisma.gymMember.findUnique({
          where: {
            organizationId_nationalId: {
              organizationId: context.organizationId,
              nationalId,
            },
          },
        })
      : Promise.resolve(null),
    passportNumber
      ? prisma.gymMember.findUnique({
          where: {
            organizationId_passportNumber: {
              organizationId: context.organizationId,
              passportNumber,
            },
          },
        })
      : Promise.resolve(null),
    // Faz 6.4 — yapılandırılmış uyruk (nationality ISO koduyla eşleşen Country satırı, varsa)
    nationality ? prisma.country.findUnique({ where: { isoCode: nationality } }) : Promise.resolve(null),
  ]);

  if (nationalIdTaken) {
    return { fieldErrors: { nationalId: 'Bu TC Kimlik No bu salonda zaten kayıtlı.' } };
  }

  if (passportTaken) {
    return { fieldErrors: { passportNumber: 'Bu pasaport numarası bu salonda zaten kayıtlı.' } };
  }

  if (data.planId && !plan) {
    return { fieldErrors: { planId: 'Geçerli bir salon üyelik planı seçin.' } };
  }

  const memberLimitError = await assertWithinMemberLimit(context.organizationId);
  if (memberLimitError) {
    return { error: memberLimitError };
  }

  let membershipEndsAt: Date | null = null;
  if (plan) {
    membershipEndsAt = new Date(membershipStartsAt);
    membershipEndsAt.setDate(membershipEndsAt.getDate() + plan.durationDays);
  }

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.gymMember.create({
      data: {
        organizationId: context.organizationId,
        planId: plan?.id ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId,
        isForeignMember: data.isForeignMember,
        nationality,
        nationalityCountryId: nationalityCountry?.id ?? null,
        passportNumber,
        phone,
        email,
        birthDate,
        gender: data.gender as Gender,
        status: data.status as GymMemberStatus,
        membershipStartsAt,
        membershipEndsAt,
        notes: data.notes || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_REGISTERED',
        entityType: 'gym_member',
        entityId: created.id,
        metadata: {
          firstName: created.firstName,
          lastName: created.lastName,
          planName: plan?.name ?? null,
          status: created.status,
          isForeignMember: created.isForeignMember,
        },
      },
    });

    return created;
  });

  revalidatePath('/dashboard/members');

  return {
    success: `${member.firstName} ${member.lastName} üye olarak kaydedildi.`,
  };
}

export type UpdateMemberRfidState = {
  error?: string;
  success?: string;
};

export async function updateMemberRfid(
  _prev: UpdateMemberRfidState,
  formData: FormData,
): Promise<UpdateMemberRfidState> {
  const context = await getMemberManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const memberId = String(formData.get('memberId') ?? '');
  const rfidTag = String(formData.get('rfidTag') ?? '').trim();

  if (!memberId) {
    return { error: 'Üye bulunamadı.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: memberId, organizationId: context.organizationId },
    select: { id: true },
  });
  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  if (rfidTag) {
    const taken = await prisma.gymMember.findFirst({
      where: {
        organizationId: context.organizationId,
        rfidTag,
        NOT: { id: memberId },
      },
      select: { id: true },
    });
    if (taken) {
      return { error: 'Bu RFID kartı başka bir üyeye atanmış.' };
    }
  }

  await prisma.gymMember.update({
    where: { id: memberId },
    data: { rfidTag: rfidTag || null },
  });

  revalidatePath(`/dashboard/members/${memberId}`);
  revalidatePath('/dashboard/check-in');

  return { success: rfidTag ? 'RFID kartı kaydedildi.' : 'RFID kartı kaldırıldı.' };
}

const healthConsentSchema = z.object({
  gymMemberId: z.string().cuid(),
  version: z.string().max(32).optional(),
});

export type HealthConsentState = {
  error?: string;
  success?: string;
};

export async function recordHealthConsent(
  _prev: HealthConsentState,
  formData: FormData,
): Promise<HealthConsentState> {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' };
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const userId = session.user.id;

  if (!organizationId || !role || !MEMBER_MANAGER_ROLES.has(role)) {
    return { error: 'Sağlık rızası kaydı için OWNER, ADMIN veya STAFF yetkisi gerekir.' };
  }

  const parsed = healthConsentSchema.safeParse({
    gymMemberId: formData.get('gymMemberId'),
    version: formData.get('version') || undefined,
  });

  if (!parsed.success) {
    return { error: 'Geçersiz form verisi.' };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: parsed.data.gymMemberId, organizationId },
  });

  if (!member) {
    return { error: 'Üye bulunamadı.' };
  }

  const version = parsed.data.version?.trim() || '1.0';
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: parsed.data.gymMemberId },
      data: {
        healthConsentAcceptedAt: now,
        healthConsentAcceptedById: userId,
        healthConsentVersion: version,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: userId,
        organizationId,
        action: 'HEALTH_CONSENT_RECORDED',
        entityType: 'gym_member',
        entityId: parsed.data.gymMemberId,
        metadata: { version },
      },
    });
  });

  revalidatePath(`/dashboard/members/${parsed.data.gymMemberId}`);

  return { success: 'Sağlık formu rızası kaydedildi.' };
}

export type PendingMemberActionState = { error?: string; success?: string };

/**
 * Mobil self-servis kayıttan (`/api/v1/auth/signup`) gelen, salon slug'ı
 * dışında hiçbir doğrulaması olmayan bir hesabı gerçek bir üyeye çevirir.
 * MembershipFreeze/TrainerRequest'teki aynı talep/onay deseni.
 */
export async function approvePendingMember(gymMemberId: string): Promise<PendingMemberActionState> {
  const context = await getMemberManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId, status: 'PENDING_APPROVAL' },
  });
  if (!member) {
    return { error: 'Onay bekleyen kayıt bulunamadı.' };
  }

  const memberLimitError = await assertWithinMemberLimit(context.organizationId);
  if (memberLimitError) {
    return { error: memberLimitError };
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: { kind: 'self_signup_approved' },
      },
    });
  });

  revalidatePath('/dashboard/members');
  return { success: `${member.firstName} ${member.lastName} onaylandı, artık giriş yapabilir.` };
}

/**
 * Sahte/hatalı bir self-servis kaydı reddeder. Veri silinmez (INACTIVE'e
 * alınır) — staff isterse geçmişe bakıp elle temizleyebilir.
 */
export async function rejectPendingMember(gymMemberId: string): Promise<PendingMemberActionState> {
  const context = await getMemberManagerContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const writeBlock = await getTenantWriteBlockReason(context.organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId: context.organizationId, status: 'PENDING_APPROVAL' },
  });
  if (!member) {
    return { error: 'Onay bekleyen kayıt bulunamadı.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymMember.update({
      where: { id: member.id },
      data: { status: 'INACTIVE' },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_UPDATED',
        entityType: 'gym_member',
        entityId: member.id,
        metadata: { kind: 'self_signup_rejected' },
      },
    });
  });

  revalidatePath('/dashboard/members');
  return { success: `${member.firstName} ${member.lastName} reddedildi.` };
}
