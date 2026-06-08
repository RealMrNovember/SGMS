'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { Gender, GymMemberStatus, OrganizationRole } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MEMBER_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);

const addGymMemberSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  nationalId: z
    .string()
    .regex(/^\d{11}$/, 'TC Kimlik No 11 haneli olmalıdır.')
    .optional()
    .or(z.literal('')),
  phone: z.string().min(10).max(20).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  planId: z.string().cuid().optional().or(z.literal('')),
  membershipStartsAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
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

  const parsed = addGymMemberSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    nationalId: formData.get('nationalId') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    birthDate: formData.get('birthDate') ?? '',
    gender: formData.get('gender'),
    status: formData.get('status'),
    planId: formData.get('planId') ?? '',
    membershipStartsAt: formData.get('membershipStartsAt') ?? '',
    notes: formData.get('notes') ?? '',
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

  const data = parsed.data;
  const nationalId = data.nationalId || null;
  const email = data.email?.toLowerCase() || null;
  const phone = data.phone || null;
  const birthDate = parseOptionalDate(data.birthDate || undefined);
  const membershipStartsAt = parseOptionalDate(data.membershipStartsAt || undefined) ?? new Date();

  const [plan, nationalIdTaken] = await Promise.all([
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
  ]);

  if (nationalIdTaken) {
    return { fieldErrors: { nationalId: 'Bu TC Kimlik No bu salonda zaten kayıtlı.' } };
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
