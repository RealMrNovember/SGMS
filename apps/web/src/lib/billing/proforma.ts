import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const TOKEN_TTL_DAYS = 30;

export type ProformaEmailStatus = 'pending' | 'sent' | 'failed';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createProformaToken(organizationId: string, billingRequestId: string) {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const record = await prisma.proformaToken.create({
    data: {
      organizationId,
      billingRequestId,
      tokenHash: hashToken(token),
      expiresAt,
      emailStatus: 'pending',
    },
  });

  return { id: record.id, token, expiresAt };
}

export async function markProformaEmailResult(
  tokenId: string,
  result: { ok: true } | { ok: false; error: string },
) {
  await prisma.proformaToken.update({
    where: { id: tokenId },
    data: result.ok
      ? {
          emailStatus: 'sent',
          emailSentAt: new Date(),
          lastEmailError: null,
        }
      : {
          emailStatus: 'failed',
          lastEmailError: result.error.slice(0, 2000),
        },
  });
}

export async function findLatestProformaForRequest(organizationId: string, billingRequestId: string) {
  return prisma.proformaToken.findFirst({
    where: { organizationId, billingRequestId },
    orderBy: { createdAt: 'desc' },
  });
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
