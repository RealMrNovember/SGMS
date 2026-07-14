import { redisIncrWithExpiry } from '@/lib/redis';

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

function memoryConsume(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - bucket.count };
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisCount = await redisIncrWithExpiry(key, windowSeconds);
  if (redisCount !== null) {
    if (redisCount > limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true, remaining: Math.max(0, limit - redisCount) };
  }

  return memoryConsume(key, limit, windowSeconds);
}

export async function consumeMessageRateLimit(userId: string, organizationId: string) {
  const perMinute = Number(process.env.MESSAGE_RATE_LIMIT_PER_MINUTE ?? '30');
  const limit = Number.isFinite(perMinute) && perMinute > 0 ? perMinute : 30;
  return consumeRateLimit(`rl:msg:${organizationId}:${userId}`, limit, 60);
}

export async function consumeTypingRateLimit(userId: string, organizationId: string) {
  return consumeRateLimit(`rl:typing:${organizationId}:${userId}`, 20, 60);
}

/** Kaba kuvvet (brute-force) parola denemesine karşı — e-posta + IP birlikte anahtarlanır,
 * tek hesaba odaklı saldırı da (aynı email), IP'den dağıtık deneme de (aynı IP, farklı email) sınırlanır. */
export async function consumeLoginRateLimit(email: string, ipAddress: string) {
  const byEmail = await consumeRateLimit(`rl:login:email:${email.toLowerCase()}`, 10, 300);
  const byIp = await consumeRateLimit(`rl:login:ip:${ipAddress}`, 30, 300);

  if (!byEmail.allowed) return byEmail;
  if (!byIp.allowed) return byIp;
  return byEmail;
}

export async function consumePasswordResetRateLimit(email: string, ipAddress: string) {
  const byEmail = await consumeRateLimit(`rl:pwreset:email:${email.toLowerCase()}`, 3, 900);
  const byIp = await consumeRateLimit(`rl:pwreset:ip:${ipAddress}`, 10, 900);

  if (!byEmail.allowed) return byEmail;
  if (!byIp.allowed) return byIp;
  return byEmail;
}
