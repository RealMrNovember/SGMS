import { prisma } from '@/lib/prisma';
import type { Prisma } from '@sgms/database';

/**
 * Aynı organizasyon için ödeme talebi oluşturma/onaylama/aktivasyon işlemlerini
 * serileştirir. Postgres transaction-scoped advisory lock kullanılır (commit veya
 * rollback'te otomatik serbest kalır, ayrıca "unlock" çağrısı gerekmez) — iki
 * eşzamanlı işlem (çift tıklama, kart ödemesiyle yarışan manuel talep, veya aynı
 * webhook'un iki kez tetiklenmesi) birbirini asla "bekleyen talep yok" sanıp ikisi
 * de geçemez. Bkz. roadmap.md Faz 36.7.
 */
export async function withOrgBillingLock<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      return fn(tx);
    },
    { timeout: 15000 },
  );
}
