import { redisGet, redisSetEx } from '@/lib/redis';

const REVOKED_PREFIX = 'staff:deactivated:';
// JWT oturumları en fazla bu kadar yaşıyor (bkz. auth.config.ts maxAge) — cache TTL'i
// onunla hizalı, süresi dolan bir oturum zaten kendiliğinden geçersiz olur.
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function key(organizationId: string, userId: string) {
  return `${REVOKED_PREFIX}${organizationId}:${userId}`;
}

/** Bir personel çıkarıldığında/devre dışı bırakıldığında çağrılır — mevcut oturumu yakında geçersiz kılar. */
export async function markStaffDeactivated(organizationId: string, userId: string) {
  await redisSetEx(key(organizationId, userId), DEFAULT_TTL_SECONDS, '1');
}

/** `null` = Redis yapılandırılmamış/bilinmiyor (fail-open) — `isActive` kontrolü zaten başka katmanlarda var. */
export async function isStaffDeactivatedCache(
  organizationId: string,
  userId: string,
): Promise<boolean | null> {
  const value = await redisGet(key(organizationId, userId));
  if (value === null) {
    return null;
  }
  return value === '1';
}
