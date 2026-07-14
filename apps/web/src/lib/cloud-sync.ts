import { prisma } from '@/lib/prisma';
import { CloudClientService, type CloudApiResult, type TenantSyncPayload } from '@sgms/cloud-client';

let client: CloudClientService | null = null;

export function getCloudClient(): CloudClientService {
  if (!client) {
    client = new CloudClientService(prisma);
  }
  return client;
}

/** Org oluşturma / trial kayıt / plan değişikliği sonrası tenant durumunu cloud.cicibyte.com'a iter. */
export async function syncOrganizationToCloud(
  organizationId: string,
): Promise<CloudApiResult<TenantSyncPayload>> {
  try {
    const result = await getCloudClient().syncOrganization(organizationId);

    if (!result.ok) {
      console.error('[cloud-sync] failed:', organizationId, result.message);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'cloud.cicibyte.com senkronu başarısız.';
    console.error('[cloud-sync] error:', organizationId, error);

    return { ok: false, statusCode: 503, message };
  }
}

/** Mevcut tüm organizasyonları cloud.cicibyte.com ile senkronize eder (backfill / cron). */
export async function syncAllOrganizationsToCloud(): Promise<{ ok: number; failed: number }> {
  return getCloudClient().syncAllOrganizations();
}
