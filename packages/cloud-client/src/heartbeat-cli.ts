import { PrismaClient } from '@sgms/database';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CloudClientService } from './cloud-client.service.js';

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

async function main() {
  loadWebEnv();

  const prisma = new PrismaClient();
  const client = new CloudClientService(prisma);

  const health = await client.checkPlatformHealth();
  console.log(`cloud.cicibyte.com health: ${health.ok ? 'OK' : 'DOWN'}`);

  const { ok, failed } = await client.syncAllOrganizations();

  console.log(`Cloud senkronu tamamlandı: ${ok} başarılı, ${failed} başarısız.`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
