import { prisma } from '@/lib/prisma';
import {
  LicenseClientService,
  type EnsureLicenseResult,
  type LicenseClientMetadata,
} from '@sgms/license-client';

let client: LicenseClientService | null = null;

export type OrganizationLicenseMeta = LicenseClientMetadata;

export function getLicenseClient(): LicenseClientService {
  if (!client) {
    client = new LicenseClientService(prisma, { appCode: 'sgms' });
  }
  return client;
}

/** Org + OWNER bilgisinden merkezi lisans paneli metadata'sı üretir. */
export async function resolveOrganizationLicenseMetadata(
  organizationId: string,
): Promise<OrganizationLicenseMeta> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      email: true,
      members: {
        where: { role: 'OWNER', isActive: true },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  if (!org) {
    return { platform: 'web', deviceName: 'SGMS Web' };
  }

  const owner = org.members[0]?.user;

  return {
    clientName: org.name,
    email: owner?.email ?? org.email ?? null,
    deviceName: 'SGMS Web',
    platform: 'web',
  };
}

/** Org oluşturma / trial kayıt sonrası merkezi lisans trial başlatır veya doğrular. */
export async function bootstrapOrganizationLicense(
  organizationId: string,
  installationId: string,
  options?: {
    licenseKey?: string | null;
    metadata?: OrganizationLicenseMeta;
    strict?: boolean;
  },
): Promise<EnsureLicenseResult> {
  try {
    const metadata =
      options?.metadata ?? (await resolveOrganizationLicenseMetadata(organizationId));

    const result = await getLicenseClient().ensureOrganizationLicense(organizationId, {
      installationId,
      licenseKey: options?.licenseKey,
      ...metadata,
    });

    if (options?.strict && !result.ok) {
      console.error('[license] bootstrap failed (strict):', organizationId, result.message);
    } else if (!result.ok) {
      console.error('[license] bootstrap failed:', organizationId, result.message);
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Lisans sunucusuna bağlanılamadı.';
    console.error('[license] bootstrap error:', organizationId, error);

    const failure: EnsureLicenseResult = {
      ok: false,
      status: 'error',
      message,
    };

    return failure;
  }
}

/** Tenant girişinde merkezi lisans doğrulama + müşteri bilgisi senkronu. */
export async function syncLicenseOnLogin(
  organizationId: string,
  installationId: string,
  metadata?: OrganizationLicenseMeta,
): Promise<void> {
  try {
    const resolved = metadata ?? (await resolveOrganizationLicenseMetadata(organizationId));
    await getLicenseClient().validateOnLogin(organizationId, installationId, {
      ...resolved,
      deviceName: 'SGMS Web Login',
    });
  } catch (error) {
    console.error('[license] login sync failed:', organizationId, error);
  }
}

/** Mevcut tüm org'ları merkezi lisans sunucusu ile senkronize eder (backfill / cron). */
export async function syncAllOrganizationLicenses(): Promise<{
  ok: number;
  failed: number;
}> {
  const organizations = await prisma.organization.findMany({
    where: { status: { in: ['ACTIVE', 'SUSPENDED', 'PENDING'] } },
    select: { id: true, slug: true, installationId: true },
  });

  let ok = 0;
  let failed = 0;

  for (const org of organizations) {
    const metadata = await resolveOrganizationLicenseMetadata(org.id);
    const result = await bootstrapOrganizationLicense(org.id, org.installationId, { metadata });

    if (result.ok) {
      ok += 1;
      console.log(`[license:sync] OK ${org.slug} (${result.status})`);
    } else {
      failed += 1;
      console.log(`[license:sync] FAIL ${org.slug}: ${result.message}`);
    }
  }

  return { ok, failed };
}
