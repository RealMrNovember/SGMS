import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const GUEST_PREFIX = 'sgms_guest_';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is required for guest pass QR tokens.');
  }
  return secret;
}

export type GuestPassQrPayload = {
  organizationId: string;
  guestPassId: string;
  exp: number;
  jti: string;
};

export function hashGuestPassToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function issueGuestPassQrToken(
  organizationId: string,
  guestPassId: string,
  validUntil: Date,
): { token: string; tokenHash: string } {
  const exp = validUntil.getTime();
  const jti = randomBytes(16).toString('base64url');
  const body = `${organizationId}:${guestPassId}:${exp}:${jti}`;
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const token = `${GUEST_PREFIX}${Buffer.from(body).toString('base64url')}.${sig}`;
  return { token, tokenHash: hashGuestPassToken(token) };
}

function parseAndVerifyGuestToken(token: string): GuestPassQrPayload | null {
  if (!token.startsWith(GUEST_PREFIX)) {
    return null;
  }

  const raw = token.slice(GUEST_PREFIX.length);
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

  const [organizationId, guestPassId, expRaw, jti] = body.split(':');
  const exp = Number(expRaw);
  if (!organizationId || !guestPassId || !jti || !Number.isFinite(exp)) {
    return null;
  }

  return { organizationId, guestPassId, exp, jti };
}

export function verifyGuestPassQrToken(token: string): GuestPassQrPayload | null {
  const payload = parseAndVerifyGuestToken(token);
  if (!payload || payload.exp < Date.now()) {
    return null;
  }
  return payload;
}

export function isGuestPassQrToken(token: string): boolean {
  return token.startsWith(GUEST_PREFIX);
}
