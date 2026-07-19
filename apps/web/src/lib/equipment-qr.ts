import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const EQUIP_PREFIX = 'sgms_equip_';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is required for equipment QR tokens.');
  }
  return secret;
}

export type EquipmentQrPayload = {
  organizationId: string;
  equipmentId: string;
  jti: string;
};

export function hashEquipmentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function issueEquipmentQrToken(
  organizationId: string,
  equipmentId: string,
): { token: string; tokenHash: string } {
  const jti = randomBytes(16).toString('base64url');
  const body = `${organizationId}:${equipmentId}:${jti}`;
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const token = `${EQUIP_PREFIX}${Buffer.from(body).toString('base64url')}.${sig}`;
  return { token, tokenHash: hashEquipmentToken(token) };
}

function parseAndVerifyEquipmentToken(token: string): EquipmentQrPayload | null {
  if (!token.startsWith(EQUIP_PREFIX)) {
    return null;
  }

  const raw = token.slice(EQUIP_PREFIX.length);
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

  const [organizationId, equipmentId, jti] = body.split(':');
  if (!organizationId || !equipmentId || !jti) {
    return null;
  }

  return { organizationId, equipmentId, jti };
}

export function verifyEquipmentQrToken(token: string): EquipmentQrPayload | null {
  return parseAndVerifyEquipmentToken(token);
}

export function isEquipmentQrToken(token: string): boolean {
  return token.startsWith(EQUIP_PREFIX);
}

export function generateEquipmentPublicCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}
