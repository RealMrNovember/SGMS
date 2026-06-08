'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const INVITABLE_ROLES = ['STAFF', 'TRAINER', 'VIEWER'] as const satisfies readonly OrganizationRole[];
const MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

const DEFAULT_STAFF_PASSWORD = 'Staff123!';

const inviteTeamMemberSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(INVITABLE_ROLES),
});

export type InviteTeamMemberState = {
  error?: string;
  success?: string;
  temporaryPassword?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof inviteTeamMemberSchema>, string>>;
};

async function getTenantContext() {
  const session = await auth();
  if (!session?.user || session.user.isSuperAdmin) {
    return { error: 'Bu işlem için tenant oturumu gerekir.' as const };
  }

  const organizationId = session.user.organizationId;
  const actorRole = session.user.role;

  if (!organizationId || !actorRole || !MANAGER_ROLES.has(actorRole)) {
    return { error: 'Personel eklemek için OWNER veya ADMIN yetkisi gerekir.' as const };
  }

  return {
    session,
    organizationId,
    actorId: session.user.id,
  };
}

export async function inviteTeamMember(
  _prevState: InviteTeamMemberState,
  formData: FormData,
): Promise<InviteTeamMemberState> {
  const context = await getTenantContext();
  if ('error' in context) {
    return { error: context.error };
  }

  const parsed = inviteTeamMemberSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    const fieldErrors: InviteTeamMemberState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field as keyof typeof fieldErrors] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const [existingUser, staffCount, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId: context.organizationId, isActive: true },
        },
      },
    }),
    prisma.organizationMember.count({
      where: {
        organizationId: context.organizationId,
        isActive: true,
        role: { in: [...INVITABLE_ROLES, 'ADMIN'] },
      },
    }),
    prisma.subscription.findFirst({
      where: {
        organizationId: context.organizationId,
        status: { in: ['TRIALING', 'ACTIVE'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (existingUser?.memberships.length) {
    return { fieldErrors: { email: 'Bu kullanıcı zaten organizasyonda kayıtlı.' } };
  }

  const maxStaff = subscription?.plan.maxStaff ?? 0;
  if (staffCount >= maxStaff) {
    return { error: `Plan personel limitine ulaşıldı (maks. ${maxStaff}).` };
  }

  const passwordHash = await hash(DEFAULT_STAFF_PASSWORD, 12);

  await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          name: data.name,
          passwordHash,
          status: 'ACTIVE',
          locale: 'tr',
        },
      }));

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { name: data.name, status: 'ACTIVE' },
      });
    }

    await tx.organizationMember.create({
      data: {
        organizationId: context.organizationId,
        userId: user.id,
        role: data.role,
        isActive: true,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        organizationId: context.organizationId,
        action: 'MEMBER_INVITED',
        entityType: 'organization_member',
        entityId: user.id,
        metadata: {
          email,
          role: data.role,
        },
      },
    });
  });

  revalidatePath('/dashboard/team');

  return {
    success: `${data.name} personel olarak eklendi.`,
    temporaryPassword: existingUser ? undefined : DEFAULT_STAFF_PASSWORD,
  };
}
