import { getLicenseClient } from '@/lib/license';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';

/** Dashboard yüklenirken merkezi lisansı tazeler; hata olursa sessizce devam eder. */
export async function refreshDashboardLicense(organizationId: string): Promise<void> {
  const access = await resolveSubscriptionAccess(organizationId);
  if (access.mode === 'full') {
    return;
  }

  try {
    await getLicenseClient().refreshOrganizationLicense(organizationId);
  } catch (error) {
    console.error('[license] dashboard refresh failed:', organizationId, error);
  }
}
