import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null | undefined;
let connectPromise: Promise<RedisClientType | null> | null = null;

function buildRedisUrl(): string | null {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST;
  const password = process.env.REDIS_PASSWORD;
  const port = process.env.REDIS_PORT ?? '6379';

  if (!host || !password) {
    return null;
  }

  return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
}

export function isRedisConfigured(): boolean {
  return Boolean(buildRedisUrl());
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client !== undefined) {
    return client;
  }

  const url = buildRedisUrl();
  if (!url) {
    client = null;
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const next = createClient({ url });
        next.on('error', () => {
          // swallow — callers fall back to DB
        });
        await next.connect();
        client = next;
        return next;
      } catch {
        client = null;
        return null;
      }
    })();
  }

  return connectPromise;
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function redisSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }
  try {
    await redis.setEx(key, ttlSeconds, value);
  } catch {
    // optional cache
  }
}

export async function redisIncrWithExpiry(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count;
  } catch {
    return null;
  }
}
