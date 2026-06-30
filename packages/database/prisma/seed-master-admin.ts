/**
 * Yalnızca Master Admin kullanıcısını oluşturur / günceller.
 * Kullanım: SEED_ADMIN_EMAIL=admin@cicibyte.com SEED_ADMIN_PASSWORD='...' pnpm admin:seed
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@cicibyte.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Alfa2020+*';
  const passwordHash = await hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'CiCiByte Master Admin',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
    },
    create: {
      email: adminEmail,
      name: 'CiCiByte Master Admin',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      locale: 'tr',
    },
  });

  await prisma.organizationMember.deleteMany({ where: { userId: user.id } });

  console.log(`Master Admin ready: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
