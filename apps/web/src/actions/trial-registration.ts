import { slugify } from '@/lib/slug';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const registerTrialSchema = z.object({
  gymName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(128),
  phone: z.string().max(32).optional().or(z.literal('')),
  country: z.string().length(2).optional().or(z.literal('')),
});

export type RegisterTrialState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof registerTrialSchema>, string>>;
  loginEmail?: string;
};

function uniqueSlug(base: string) {
  const normalized = slugify(base);
  return normalized || `salon-${Date.now().toString(36)}`;
}

export async function registerTrialOrganization(
  _prev: RegisterTrialState,
  formData: FormData,
): Promise<RegisterTrialState> {
  const parsed = registerTrialSchema.safeParse({
    gymName: formData.get('gymName'),
    ownerName: formData.get('ownerName'),
    ownerEmail: formData.get('ownerEmail'),
    ownerPassword: formData.get('ownerPassword'),
    phone: formData.get('phone') ?? '',
    country: formData.get('country') ?? 'TR',
  });

  if (!parsed.success) {
    const fieldErrors: RegisterTrialState['fieldErrors'] = {};
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
  let slug = uniqueSlug(data.gymName);

  const [emailTaken, starterPlan] = await Promise.all([
    prisma.user.findUnique({ where: { email: ownerEmail } }),
    prisma.plan.findFirst({
      where: { code: 'starter', currency: 'TRY', isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (emailTaken) {
    return {
      fieldErrors: { ownerEmail: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' },
    };
  }

  if (!starterPlan) {
    return { error: 'Deneme planı şu an yapılandırılmamış. Lütfen destek ile iletişime geçin.' };
  }

  const slugExists = await prisma.organization.findUnique({ where: { slug } });
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const passwordHash = await hash(data.ownerPassword, 12);
  const installationId = randomUUID();
  const trialEndsAt = new Date(Date.now() + siteConfig.trialDays * 24 * 60 * 60 * 1000);

  const { organization } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.gymName.trim(),
        slug,
        email: ownerEmail,
        phone: data.phone?.trim() || null,
        country: data.country || 'TR',
        status: 'ACTIVE',
        installationId,
      },
    });

    const owner = await tx.user.create({
      data: {
        email: ownerEmail,
        name: data.ownerName.trim(),
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
        planId: starterPlan.id,
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
        trialEndsAt,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: owner.id,
        organizationId: org.id,
        action: 'ORGANIZATION_CREATED',
        entityType: 'organization',
        entityId: org.id,
        metadata: {
          planCode: starterPlan.code,
          ownerEmail,
          source: 'public_trial_registration',
          trialDays: siteConfig.trialDays,
        },
      },
    });

    return { organization: org };
  });

  const { syncOrganizationToCloud } = await import('@/lib/cloud-sync');

  const syncResult = await syncOrganizationToCloud(organization.id);

  if (!syncResult.ok) {
    console.error('[trial-registration] cloud sync deferred:', syncResult.message);
  }

  return {
    success: `${siteConfig.trialDays} günlük deneme hesabınız hazır. Giriş yaparak salonunuzu yönetmeye başlayabilirsiniz.`,
    loginEmail: ownerEmail,
  };
}
