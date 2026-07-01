import { redisGet, redisSetEx } from '@/lib/redis';

const REVOKED_PREFIX = 'api:revoked:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 31;

export function revokedTokenCacheKey(tokenHash: string) {
  return `${REVOKED_PREFIX}${tokenHash}`;
}

export async function cacheRevokedToken(tokenHash: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  await redisSetEx(revokedTokenCacheKey(tokenHash), ttlSeconds, '1');
}

export async function isTokenRevokedInCache(tokenHash: string): Promise<boolean | null> {
  const value = await redisGet(revokedTokenCacheKey(tokenHash));
  if (value === null) {
    return null;
  }
  return value === '1';
}
