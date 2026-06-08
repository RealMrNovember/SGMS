import { prisma } from '@/lib/prisma';
import { LicenseClientService } from '@sgms/license-client';

let client: LicenseClientService | null = null;

export function getLicenseClient(): LicenseClientService {
  if (!client) {
    client = new LicenseClientService(prisma, { appCode: 'sgms' });
  }
  return client;
}

/** Org oluşturma sonrası trial / validate — hata durumunda org oluşturmayı engellemez. */
export async function bootstrapOrganizationLicense(
  organizationId: string,
  installationId: string,
  licenseKey?: string | null,
): Promise<void> {
  try {
    await getLicenseClient().ensureOrganizationLicense(organizationId, {
      installationId,
      licenseKey,
    });
  } catch (error) {
    console.error('[license] bootstrap failed:', organizationId, error);
  }
}

/** Tenant girişinde merkezi lisans doğrulama. */
export async function syncLicenseOnLogin(
  organizationId: string,
  installationId: string,
): Promise<void> {
  try {
    await getLicenseClient().validateOnLogin(organizationId, installationId);
  } catch (error) {
    console.error('[license] login sync failed:', organizationId, error);
  }
}
