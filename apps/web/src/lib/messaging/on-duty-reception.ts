import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';

export type OnDutyReception = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Açık kasa vardiyasındaki kişi mi, yoksa yedek personel mi */
  source: 'open_shift' | 'fallback_staff';
  role: OrganizationRole;
  shiftOpenedAt: string | null;
};

const FALLBACK_ROLE_ORDER: OrganizationRole[] = ['STAFF', 'ADMIN', 'OWNER'];

/**
 * Sporcunun yazacağı “resepsiyon” muhatabı:
 * 1) Açık kasa vardiyasını açan kullanıcı (`CashRegisterShift.openedById`) — mesaideki kişi
 * 2) Yoksa aktif STAFF → ADMIN → OWNER (ilk eşleşen)
 */
export async function resolveOnDutyReception(
  organizationId: string,
  excludeUserId?: string,
): Promise<OnDutyReception | null> {
  const openShift = await prisma.cashRegisterShift.findFirst({
    where: { organizationId, closedAt: null },
    orderBy: { openedAt: 'desc' },
    include: {
      openedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  if (openShift?.openedBy && openShift.openedBy.id !== excludeUserId) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: openShift.openedBy.id,
        isActive: true,
      },
      select: { role: true },
    });

    return {
      userId: openShift.openedBy.id,
      name: openShift.openedBy.name ?? openShift.openedBy.email,
      email: openShift.openedBy.email,
      avatarUrl: openShift.openedBy.avatarUrl,
      source: 'open_shift',
      role: membership?.role ?? 'STAFF',
      shiftOpenedAt: openShift.openedAt.toISOString(),
    };
  }

  for (const role of FALLBACK_ROLE_ORDER) {
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        isActive: true,
        role,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    if (member) {
      return {
        userId: member.user.id,
        name: member.user.name ?? member.user.email,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        source: 'fallback_staff',
        role: member.role,
        shiftOpenedAt: null,
      };
    }
  }

  return null;
}
