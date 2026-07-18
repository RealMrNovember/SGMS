import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createProformaToken(organizationId: string, billingRequestId: string) {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.proformaToken.create({
    data: { organizationId, billingRequestId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

export type ProformaTokenCheck =
  | { valid: true; organizationId: string; billingRequestId: string }
  | { valid: false; reason: 'not_found' | 'expired' };

export async function verifyProformaToken(token: string): Promise<ProformaTokenCheck> {
  const record = await prisma.proformaToken.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!record) {
    return { valid: false, reason: 'not_found' };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, organizationId: record.organizationId, billingRequestId: record.billingRequestId };
}
