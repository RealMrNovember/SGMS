import { PrismaClient } from '@sgms/database';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LicenseClientService } from './license-client.service.js';
import type { LicenseClientMetadata } from './types.js';

function loadWebEnv(): void {
  const candidates = [
    resolve(process.cwd(), '../../apps/web/.env.local'),
    resolve(process.cwd(), '../../../apps/web/.env.local'),
    '/www/wwwroot/sgms.cicibyte.com/apps/web/.env.local',
  ];

  for (const file of candidates) {
    if (!existsSync(file)) {
      continue;
    }

    const content = readFileSync(file, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/\r$/, '').trim();
      }
    }
    break;
  }
}

async function resolveOrgMetadata(
  prisma: PrismaClient,
  organizationId: string,
): Promise<LicenseClientMetadata> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      email: true,
      members: {
        where: { role: 'OWNER', isActive: true },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });

  if (!org) {
    return { platform: 'web', deviceName: 'SGMS Heartbeat' };
  }

  return {
    clientName: org.name,
    email: org.members[0]?.user.email ?? org.email ?? null,
    deviceName: 'SGMS Heartbeat',
    platform: 'web',
  };
}

async function main() {
  loadWebEnv();

  const prisma = new PrismaClient();
  const client = new LicenseClientService(prisma, { appCode: 'sgms' });

  const organizations = await prisma.organization.findMany({
    where: { status: { in: ['ACTIVE', 'SUSPENDED', 'PENDING'] } },
    select: { id: true, slug: true },
  });

  let ok = 0;
  let failed = 0;

  for (const org of organizations) {
    const fullOrg = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { id: true, slug: true, installationId: true },
    });

    const metadata = await resolveOrgMetadata(prisma, fullOrg.id);

    const result = await client.ensureOrganizationLicense(fullOrg.id, {
      installationId: fullOrg.installationId,
      ...metadata,
    });

    if (result.ok) {
      ok += 1;
      console.log(`OK  ${org.slug} (${result.status})`);
    } else {
      failed += 1;
      console.log(`FAIL ${org.slug}: ${result.message}`);
    }
  }

  console.log(`Heartbeat tamamlandı: ${ok} başarılı, ${failed} başarısız.`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
