import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { redisSetNx } from '@/lib/redis';

const QR_PREFIX = 'sgms_qr_';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Redis yoksa tek-kullanımlık kilidi süreç belleğinde tutar (çok örnekli deployda zayıf ama offline değil). */
const memoryUsed = new Map<string, number>();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is required for check-in QR tokens.');
  }
  return secret;
}

export type CheckInQrPayload = {
  organizationId: string;
  gymMemberId: string;
  exp: number;
  jti: string;
};

export function issueCheckInQrToken(
  organizationId: string,
  gymMemberId: string,
  ttlMs = DEFAULT_TTL_MS,
): { token: string; expiresAt: Date } {
  const exp = Date.now() + ttlMs;
  const jti = randomBytes(16).toString('base64url');
  const body = `${organizationId}:${gymMemberId}:${exp}:${jti}`;
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const token = `${QR_PREFIX}${Buffer.from(body).toString('base64url')}.${sig}`;
  return { token, expiresAt: new Date(exp) };
}

function parseAndVerifySignature(token: string): CheckInQrPayload | null {
  if (!token.startsWith(QR_PREFIX)) {
    return null;
  }

  const raw = token.slice(QR_PREFIX.length);
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) {
    return null;
  }

  const encodedBody = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  let body: string;
  try {
    body = Buffer.from(encodedBody, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedSig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const [organizationId, gymMemberId, expRaw, jti] = body.split(':');
  const exp = Number(expRaw);
  if (!organizationId || !gymMemberId || !jti || !Number.isFinite(exp) || exp < Date.now()) {
    return null;
  }

  return { organizationId, gymMemberId, exp, jti };
}

async function consumeJti(jti: string, exp: number): Promise<'ok' | 'already_used'> {
  const ttlSeconds = Math.max(1, Math.ceil((exp - Date.now()) / 1000));
  const key = `qr:used:${jti}`;

  const redisResult = await redisSetNx(key, ttlSeconds, '1');
  if (redisResult === true) {
    return 'ok';
  }
  if (redisResult === false) {
    return 'already_used';
  }

  // Redis yok → bellek fallback
  const now = Date.now();
  for (const [k, until] of memoryUsed) {
    if (until <= now) memoryUsed.delete(k);
  }
  if (memoryUsed.has(jti)) {
    return 'already_used';
  }
  memoryUsed.set(jti, exp);
  return 'ok';
}

/** İmza + süre kontrolü; tek kullanımlık tüketim yapmaz (yalnızca debug / önizleme). */
export function verifyCheckInQrToken(token: string): CheckInQrPayload | null {
  return parseAndVerifySignature(token);
}

/**
 * QR'ı doğrular ve tek kullanımlık olarak tüketir.
 * Aynı token (ekran görüntüsü dahil) ikinci kez sunulursa `already_used` döner.
 */
export async function verifyAndConsumeCheckInQrToken(
  token: string,
): Promise<{ ok: true; payload: CheckInQrPayload } | { ok: false; reason: 'invalid' | 'already_used' }> {
  const payload = parseAndVerifySignature(token);
  if (!payload) {
    return { ok: false, reason: 'invalid' };
  }

  const consumed = await consumeJti(payload.jti, payload.exp);
  if (consumed === 'already_used') {
    return { ok: false, reason: 'already_used' };
  }

  return { ok: true, payload };
}
