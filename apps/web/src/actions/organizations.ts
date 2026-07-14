'use server';

import { auth } from '@/lib/auth';
import { syncOrganizationToCloud } from '@/lib/cloud-sync';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const createOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(120),
  organizationSlug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  organizationEmail: z.string().email().optional().or(z.literal('')),
  planId: z.string().cuid(),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(128),
});

export type CreateOrganizationState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof createOrganizationSchema>, string>>;
};

export async function createOrganization(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return { error: 'Bu işlem için Super Admin yetkisi gerekir.' };
  }

  const parsed = createOrganizationSchema.safeParse({
    organizationName: formData.get('organizationName'),
    organizationSlug: formData.get('organizationSlug'),
    organizationEmail: formData.get('organizationEmail') ?? '',
    planId: formData.get('planId'),
    ownerName: formData.get('ownerName'),
    ownerEmail: formData.get('ownerEmail'),
    ownerPassword: formData.get('ownerPassword'),
  });

  if (!parsed.success) {
    const fieldErrors: CreateOrganizationState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string') {
        fieldErrors[field as keyof typeof fieldErrors] = issue.message;
      }
    }
    return { error: 'Lütfen form alanlarını kontrol edin.', fieldErrors };
  }

  const data = parsed.data;
  const ownerEmail = data.ownerEmail.toLowerCase();
  const orgEmail = data.organizationEmail || ownerEmail;
  const slug = data.organizationSlug || slugify(data.organizationName);

  const [slugTaken, emailTaken, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email: ownerEmail } }),
    prisma.plan.findFirst({ where: { id: data.planId, isActive: true } }),
  ]);

  if (slugTaken) {
    return { fieldErrors: { organizationSlug: 'Bu slug zaten kullanılıyor.' } };
  }

  if (emailTaken) {
    return { fieldErrors: { ownerEmail: 'Bu e-posta adresi zaten kayıtlı.' } };
  }

  if (!plan) {
    return { fieldErrors: { planId: 'Geçerli bir plan seçin.' } };
  }

  const passwordHash = await hash(data.ownerPassword, 12);
  const installationId = randomUUID();

  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.organizationName,
        slug,
        email: orgEmail,
        country: 'TR',
        status: 'ACTIVE',
        installationId,
      },
    });

    const owner = await tx.user.create({
      data: {
        email: ownerEmail,
        name: data.ownerName,
        passwordHash,
        status: 'ACTIVE',
        locale: 'tr',
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: owner.id,
        role: 'OWNER',
        isActive: true,
        joinedAt: new Date(),
      },
    });

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        organizationId: org.id,
        action: 'ORGANIZATION_CREATED',
        entityType: 'organization',
        entityId: org.id,
        metadata: {
          planCode: plan.code,
          ownerEmail,
          createdBySuperAdmin: true,
        },
      },
    });

    return org;
  });

  await syncOrganizationToCloud(organization.id);

  revalidatePath('/admin');
  redirect(`/admin?created=${organization.slug}`);
}
