import { apiError, apiOk } from '@/lib/api/response';
import { issueApiToken } from '@/lib/api/token';
import { writeAuditLog } from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';
import { assertWithinMemberLimit, getTenantWriteBlockReason } from '@/lib/tenant-access';
import { hash } from 'bcryptjs';
import { z } from 'zod';

const signupSchema = z.object({
  organizationSlug: z.string().min(2).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).optional(),
});

/**
 * Sporcu self-signup: salon slug'ı ile hesap + GymMember oluşturur.
 * İlk paket satışı ayrı endpoint (`/me/membership/renew` + planId) ile yapılır.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz JSON.', 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Kayıt bilgileri geçersiz. E-posta, parola (min. 8) ve ad soyad gerekli.', 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const slug = parsed.data.organizationSlug.trim().toLowerCase();
  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const phone = parsed.data.phone?.trim() || null;

  const org = await prisma.organization.findFirst({
    where: {
      slug,
      status: { in: ['ACTIVE', 'TRIAL'] },
    },
    select: { id: true, name: true, slug: true },
  });
  if (!org) {
    return apiError('Salon bulunamadı veya kayıt kabul etmiyor.', 404);
  }

  const writeBlock = await getTenantWriteBlockReason(org.id);
  if (writeBlock) {
    return apiError(writeBlock, 403);
  }

  const memberLimit = await assertWithinMemberLimit(org.id);
  if (memberLimit) {
    return apiError(memberLimit, 403);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return apiError('Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.', 409);
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const displayName = `${firstName} ${lastName}`.trim();

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
        status: 'ACTIVE',
        isSuperAdmin: false,
        locale: 'tr',
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: 'VIEWER',
        isActive: true,
        joinedAt: new Date(),
      },
    });

    const gymMember = await tx.gymMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        firstName,
        lastName,
        email,
        phone,
        status: 'ACTIVE',
        locale: 'tr',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        organizationId: org.id,
        action: 'MEMBER_REGISTERED',
        entityType: 'gym_member',
        entityId: gymMember.id,
        metadata: { kind: 'athlete_self_signup', email, source: 'mobile' },
      },
    });

    return { user, gymMember };
  });

  const issued = await issueApiToken({
    userId: created.user.id,
    organizationId: org.id,
    scope: 'ATHLETE',
    gymMemberId: created.gymMember.id,
    role: null,
    label: 'mobile-signup',
  });

  void writeAuditLog({
    actorId: created.user.id,
    organizationId: org.id,
    action: 'USER_LOGIN',
    entityType: 'api_token',
    entityId: created.user.id,
    metadata: { scope: 'ATHLETE', source: 'api_v1_auth_signup' },
  });

  return apiOk(
    {
      accessToken: issued.accessToken,
      tokenType: 'Bearer',
      expiresAt: issued.expiresAt.toISOString(),
      scope: 'athlete',
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
        locale: created.user.locale,
      },
      organizationId: org.id,
      organization: { id: org.id, name: org.name, slug: org.slug },
      gymMemberId: created.gymMember.id,
      role: null,
      needsMembershipPurchase: true,
    },
    201,
  );
}
