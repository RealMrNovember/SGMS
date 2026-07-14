import { syncOrganizationToCloud } from '@/lib/cloud-sync';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';

/** Dashboard yüklenirken cloud.cicibyte.com tenant kaydını tazeler; hata olursa sessizce devam eder. */
export async function refreshDashboardLicense(organizationId: string): Promise<void> {
  const access = await resolveSubscriptionAccess(organizationId);
  if (access.mode === 'full') {
    return;
  }

  await syncOrganizationToCloud(organizationId);
}
