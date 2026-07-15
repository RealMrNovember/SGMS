import { auth } from '@/lib/auth';

/**
 * Temsilci (partner) portalı server action'larının ortak girişi. Yalnızca aktif
 * bir Partner profiline sahip kullanıcılar geçer — session.user.partnerId, auth.ts'de
 * yalnızca `Partner.isActive` true iken doldurulur (bkz. lib/auth.ts).
 */
export async function requirePartner() {
  const session = await auth();
  if (!session?.user?.isPartner || !session.user.partnerId) {
    throw new Error('Bu işlem için temsilci yetkisi gerekir.');
  }
  return { session, partnerId: session.user.partnerId };
}

/** Bir organizasyonun, giriş yapan temsilciye atanmış olduğunu doğrular. */
export async function requirePartnerOwnsOrganization(organizationId: string) {
  const { session, partnerId } = await requirePartner();
  const { prisma } = await import('@/lib/prisma');

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, partnerId: true },
  });

  if (!organization || organization.partnerId !== partnerId) {
    throw new Error('Bu organizasyon size atanmış değil.');
  }

  return { session, partnerId, organization };
}
