import { prisma } from '@/lib/prisma';

export type TrainerProfilePublic = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
  maxMembers: number | null;
  memberCount: number;
  isAtCapacity: boolean;
};

/** Aktif PT profilleri — sporcu portalı ve mobil liste için. */
export async function listActiveTrainerProfiles(organizationId: string): Promise<TrainerProfilePublic[]> {
  const trainerMemberships = await prisma.organizationMember.findMany({
    where: { organizationId, role: 'TRAINER', isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const userIds = trainerMemberships.map((m) => m.userId);
  const [profiles, memberCounts] = await Promise.all([
    prisma.trainerProfile.findMany({
      where: { organizationId, userId: { in: userIds }, isActive: true },
    }),
    prisma.gymMember.groupBy({
      by: ['trainerId'],
      where: { organizationId, status: 'ACTIVE', trainerId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);

  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  const countByTrainerId = new Map(
    memberCounts.filter((row) => row.trainerId).map((row) => [row.trainerId!, row._count._all]),
  );

  return trainerMemberships
    .map((membership) => {
      const profile = profileByUserId.get(membership.userId);
      if (profile && !profile.isActive) {
        return null;
      }
      const memberCount = countByTrainerId.get(membership.userId) ?? 0;
      const maxMembers = profile?.maxMembers ?? null;
      return {
        id: profile?.id ?? membership.userId,
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl,
        bio: profile?.bio ?? null,
        specialties: profile?.specialties ?? [],
        maxMembers,
        memberCount,
        isAtCapacity: maxMembers != null && memberCount >= maxMembers,
      };
    })
    .filter((row): row is TrainerProfilePublic => row !== null);
}

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

export function canViewTrainerRequestReason(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role);
}

export function stripTrainerRequestReason<T extends { reason?: string | null }>(
  row: T,
  role: string | null | undefined,
): Omit<T, 'reason'> {
  if (canViewTrainerRequestReason(role)) {
    return row;
  }
  const { reason: _reason, ...rest } = row;
  return rest;
}
