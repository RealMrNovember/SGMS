import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export type HierarchyNode = { id: string; name: string; parentOrganizationId: string | null };

/**
 * Bir organizasyon düğümünün (şirket/bölge/şube) altındaki TÜM torun organizasyonların
 * id listesini döner (kök dahil). Prisma recursive CTE desteklemediği için seviye seviye
 * JS tarafında ağaç gezinir — gerçekçi hiyerarşi boyutları (~100 şube) için yeterlidir.
 */
export async function resolveDescendantOrganizationIds(rootOrganizationId: string): Promise<string[]> {
  const collected = new Set<string>([rootOrganizationId]);
  let frontier = [rootOrganizationId];

  while (frontier.length > 0) {
    const children = await prisma.organization.findMany({
      where: { parentOrganizationId: { in: frontier } },
      select: { id: true },
    });
    const nextFrontier = children.map((c) => c.id).filter((id) => !collected.has(id));
    if (nextFrontier.length === 0) break;
    for (const id of nextFrontier) collected.add(id);
    frontier = nextFrontier;
  }

  return Array.from(collected);
}

/** Bir düğümün doğrudan alt organizasyonlarını (bir seviye) isim/id ile döner — yönetim UI'ı için. */
export async function listChildOrganizations(organizationId: string): Promise<HierarchyNode[]> {
  return prisma.organization.findMany({
    where: { parentOrganizationId: organizationId },
    select: { id: true, name: true, parentOrganizationId: true },
    orderBy: { name: 'asc' },
  });
}

/** Giriş yapan kullanıcının aktif hiyerarşi atamalarını (hangi düğümlerde hangi rolle) döner. */
export async function getUserHierarchyScopes(userId: string) {
  return prisma.hierarchyMember.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      role: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { organization: { name: 'asc' } },
  });
}

/**
 * Server action/sayfa girişi: giriş yapan kullanıcının, verilen organizationId düğümü
 * üzerinde aktif bir HierarchyMember ataması olduğunu doğrular. Mevcut OrganizationRole
 * (tenant-level) yetkisinden tamamen bağımsızdır.
 */
export async function requireHierarchyAccess(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isHierarchyMember) {
    throw new Error('Bu görünüm için kurumsal hiyerarşi yetkisi gerekir.');
  }

  const grant = await prisma.hierarchyMember.findFirst({
    where: { organizationId, userId: session.user.id, isActive: true },
  });

  if (!grant) {
    throw new Error('Bu organizasyon düğümü için yetkiniz yok.');
  }

  return { session, grant };
}
