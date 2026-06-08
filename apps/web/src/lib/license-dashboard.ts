import { getLicenseClient } from '@/lib/license';

/** Dashboard yüklenirken merkezi lisansı tazeler; hata olursa sessizce devam eder. */
export async function refreshDashboardLicense(organizationId: string): Promise<void> {
  try {
    await getLicenseClient().refreshOrganizationLicense(organizationId);
  } catch (error) {
    console.error('[license] dashboard refresh failed:', organizationId, error);
  }
}
