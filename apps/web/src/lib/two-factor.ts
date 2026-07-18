import { authenticator } from 'otplib';
import { hash, compare } from 'bcryptjs';
import { randomBytes } from 'crypto';

authenticator.options = { window: 1 };

const ISSUER = 'SGMS';
const BACKUP_CODE_COUNT = 10;

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function buildOtpauthUrl(email: string, secret: string) {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotpToken(token: string, secret: string) {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

function randomBackupCode() {
  // 10 karakter, okunabilir (0/O, 1/I karışmasın diye alfabe daraltıldı)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export async function generateBackupCodes() {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => randomBackupCode());
  const hashed = await Promise.all(plain.map((code) => hash(code, 10)));
  return { plain, hashed };
}

export async function matchBackupCode(
  code: string,
  candidates: { id: string; codeHash: string }[],
) {
  const normalized = code.trim().toUpperCase();
  for (const candidate of candidates) {
    if (await compare(normalized, candidate.codeHash)) {
      return candidate.id;
    }
  }
  return null;
}
