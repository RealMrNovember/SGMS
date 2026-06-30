import { createHmac, timingSafeEqual } from 'crypto';

const QR_PREFIX = 'sgms_qr_';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

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
};

export function issueCheckInQrToken(
  organizationId: string,
  gymMemberId: string,
  ttlMs = DEFAULT_TTL_MS,
): { token: string; expiresAt: Date } {
  const exp = Date.now() + ttlMs;
  const body = `${organizationId}:${gymMemberId}:${exp}`;
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const token = `${QR_PREFIX}${Buffer.from(body).toString('base64url')}.${sig}`;
  return { token, expiresAt: new Date(exp) };
}

export function verifyCheckInQrToken(token: string): CheckInQrPayload | null {
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

  const [organizationId, gymMemberId, expRaw] = body.split(':');
  const exp = Number(expRaw);
  if (!organizationId || !gymMemberId || !Number.isFinite(exp) || exp < Date.now()) {
    return null;
  }

  return { organizationId, gymMemberId, exp };
}
