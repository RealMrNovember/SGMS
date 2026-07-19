import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const TOKEN_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Yeni bir 2FA kurtarma token'ı üretir. Plaintext yalnızca burada döner. */
export async function createTwoFactorRecoveryToken(
  userId: string,
  ipAddress?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.twoFactorRecoveryToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ipAddress: ipAddress ?? null },
  });

  return { token, expiresAt };
}

export type TwoFactorRecoveryTokenCheck =
  | { valid: true; tokenId: string; userId: string }
  | { valid: false; reason: 'not_found' | 'expired' | 'used' };

export async function verifyTwoFactorRecoveryToken(token: string): Promise<TwoFactorRecoveryTokenCheck> {
  const record = await prisma.twoFactorRecoveryToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) {
    return { valid: false, reason: 'not_found' };
  }
  if (record.usedAt) {
    return { valid: false, reason: 'used' };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, tokenId: record.id, userId: record.userId };
}

export async function consumeTwoFactorRecoveryToken(tokenId: string): Promise<void> {
  await prisma.twoFactorRecoveryToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
