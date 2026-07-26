import { apiError, apiOk } from '@/lib/api/response';
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
 *
 * **Güvenlik kararı:** Salon slug'ı serbest metin olduğundan (fiziksel bir
 * QR/kod doğrulaması yok) ve hiçbir e-posta/kimlik doğrulaması yapılmadığından,
 * hesap doğrudan ACTIVE olarak açılmaz — salonun kendi personeli/sahibi
 * onaylayana kadar `PENDING_APPROVAL` durumunda kalır ve token verilmez
 * (`/api/v1/auth/login` zaten yalnızca `status==='ACTIVE'` üyelere token
 * veriyor — bu akış aynı korumayı en baştan uygular, MembershipFreeze/
 * TrainerRequest'teki aynı talep/onay desenini yeniden kullanır).
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
        status: 'PENDING_APPROVAL',
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
        metadata: { kind: 'athlete_self_signup', email, source: 'mobile', status: 'PENDING_APPROVAL' },
      },
    });

    return { user, gymMember };
  });

  // Token verilmiyor — hesap PENDING_APPROVAL'da; onaylanana kadar
  // /api/v1/auth/login de zaten reddedecek (status==='ACTIVE' şartı).
  return apiOk(
    {
      pendingApproval: true,
      organization: { id: org.id, name: org.name, slug: org.slug },
      gymMemberId: created.gymMember.id,
    },
    201,
  );
}
