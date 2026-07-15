import { prisma } from '@/lib/prisma';

export type TrainerMonthlyStats = {
  sessionCount: number;
  hoursWorked: number;
  grossRevenue: number;
  totalCommission: number;
  canceledCount: number;
  noShowCount: number;
  noShowRate: number;
};

function monthRange(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

/** Bir PT'nin belirli bir ay için performans özeti — dashboard kartları ve detay
 * sayfasında kullanılır. Ay verilmezse içinde bulunulan ay hesaplanır. */
export async function getTrainerMonthlyStats(
  organizationId: string,
  trainerUserId: string,
  reference: Date = new Date(),
): Promise<TrainerMonthlyStats> {
  const { start, end } = monthRange(reference);

  const sessions = await prisma.ptSession.findMany({
    where: {
      organizationId,
      trainerUserId,
      scheduledAt: { gte: start, lt: end },
    },
    select: {
      status: true,
      durationMinutes: true,
      revenueAmount: true,
      commissionAmount: true,
    },
  });

  const completed = sessions.filter((s) => s.status === 'COMPLETED');
  const canceled = sessions.filter(
    (s) => s.status === 'CANCELED_BY_MEMBER' || s.status === 'CANCELED_BY_TRAINER',
  );
  const noShow = sessions.filter((s) => s.status === 'NO_SHOW');

  const hoursWorked = completed.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  const grossRevenue = completed.reduce((sum, s) => sum + Number(s.revenueAmount ?? 0), 0);
  const totalCommission = completed.reduce((sum, s) => sum + Number(s.commissionAmount ?? 0), 0);

  const totalScheduled = sessions.length;
  const noShowRate = totalScheduled > 0 ? (noShow.length / totalScheduled) * 100 : 0;

  return {
    sessionCount: completed.length,
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    canceledCount: canceled.length,
    noShowCount: noShow.length,
    noShowRate: Math.round(noShowRate * 10) / 10,
  };
}

/** Salon içindeki tüm aktif TRAINER'ların listesi + o ayki performans özeti (roster ekranı). */
export async function listTrainersWithMonthlyStats(organizationId: string, reference: Date = new Date()) {
  const trainerMemberships = await prisma.organizationMember.findMany({
    where: { organizationId, role: 'TRAINER', isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const profiles = await prisma.trainerProfile.findMany({
    where: { organizationId },
  });
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  const rows = await Promise.all(
    trainerMemberships.map(async (membership) => ({
      user: membership.user,
      profile: profileByUserId.get(membership.userId) ?? null,
      stats: await getTrainerMonthlyStats(organizationId, membership.userId, reference),
    })),
  );

  return rows;
}
