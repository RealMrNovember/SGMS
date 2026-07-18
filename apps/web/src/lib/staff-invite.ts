import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const TOKEN_TTL_MINUTES = 60 * 24 * 7; // 7 gün

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Yeni bir personel daveti token'ı üretir. Plaintext yalnızca burada döner. */
export async function createStaffInviteToken(
  userId: string,
  organizationId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.staffInviteToken.create({
    data: { userId, organizationId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
}

export type StaffInviteTokenCheck =
  | { valid: true; tokenId: string; userId: string }
  | { valid: false; reason: 'not_found' | 'expired' | 'used' };

export async function verifyStaffInviteToken(token: string): Promise<StaffInviteTokenCheck> {
  const record = await prisma.staffInviteToken.findUnique({
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

export async function consumeStaffInviteToken(tokenId: string): Promise<void> {
  await prisma.staffInviteToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
