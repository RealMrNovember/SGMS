import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxMembers: number;
  maxDevices: number;
  maxStaff: number;
  features: string[];
};

const planTemplates: Omit<PlanSeed, 'currency' | 'priceMonthly' | 'priceYearly'>[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Küçük salonlar için temel üyelik ve giriş yönetimi.',
    sortOrder: 1,
    maxMembers: 150,
    maxDevices: 2,
    maxStaff: 3,
    features: ['member_management', 'check_in', 'basic_reports'],
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Büyüyen salonlar için gelişmiş raporlama ve çoklu cihaz.',
    sortOrder: 2,
    maxMembers: 500,
    maxDevices: 6,
    maxStaff: 10,
    features: ['member_management', 'check_in', 'advanced_reports', 'sms_notifications', 'api_access'],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Zincir salonlar ve yüksek hacimli operasyonlar.',
    sortOrder: 3,
    maxMembers: 5000,
    maxDevices: 25,
    maxStaff: 50,
    features: ['member_management', 'check_in', 'advanced_reports', 'sms_notifications', 'api_access', 'multi_branch', 'priority_support'],
  },
  {
    code: 'franchise',
    name: 'Franchise',
    description: 'Franchise ağı yönetimi ve merkezi raporlama.',
    sortOrder: 4,
    maxMembers: 20000,
    maxDevices: 100,
    maxStaff: 200,
    features: ['member_management', 'check_in', 'advanced_reports', 'sms_notifications', 'api_access', 'multi_branch', 'franchise_dashboard', 'dedicated_support'],
  },
];

const currencyPricing: Record<string, { monthly: number[]; yearly: number[] }> = {
  TRY: { monthly: [999, 2499, 5999, 9999], yearly: [9990, 24990, 59990, 99990] },
  USD: { monthly: [29, 79, 199, 349], yearly: [290, 790, 1990, 3490] },
  AZN: { monthly: [49, 129, 329, 579], yearly: [490, 1290, 3290, 5790] },
};

function buildPlans(): PlanSeed[] {
  const plans: PlanSeed[] = [];

  for (const [currency, pricing] of Object.entries(currencyPricing)) {
    planTemplates.forEach((template, index) => {
      plans.push({
        ...template,
        currency,
        priceMonthly: pricing.monthly[index],
        priceYearly: pricing.yearly[index],
      });
    });
  }

  return plans;
}

async function seedPlans() {
  const plans = buildPlans();

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        code_currency: {
          code: plan.code,
          currency: plan.currency,
        },
      },
      update: {
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxMembers: plan.maxMembers,
        maxDevices: plan.maxDevices,
        maxStaff: plan.maxStaff,
        features: plan.features,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        currency: plan.currency,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxMembers: plan.maxMembers,
        maxDevices: plan.maxDevices,
        maxStaff: plan.maxStaff,
        features: plan.features,
      },
    });
  }

  console.log(`Seeded ${plans.length} plans (TRY / USD / AZN).`);
}

async function seedDemoTenant() {
  if (process.env.SEED_DEMO_TENANT === 'false') {
    return;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.sgms.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  const starterPlan = await prisma.plan.findUniqueOrThrow({
    where: { code_currency: { code: 'starter', currency: 'TRY' } },
  });

  const passwordHash = await hash(adminPassword, 12);
  const installationId = randomUUID();

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'CiCiByte Super Admin',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
    },
    create: {
      email: adminEmail,
      name: 'CiCiByte Super Admin',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      locale: 'tr',
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-gym' },
    update: {
      name: 'Demo Gym',
      status: 'PENDING',
    },
    create: {
      name: 'Demo Gym',
      slug: 'demo-gym',
      email: adminEmail,
      country: 'TR',
      installationId,
      status: 'PENDING',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      role: 'OWNER',
      isActive: true,
      joinedAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
      isActive: true,
      joinedAt: new Date(),
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({
    where: { organizationId: organization.id },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        planId: starterPlan.id,
        status: 'TRIALING',
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: starterPlan.id,
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`Demo tenant ready: ${adminEmail}`);
}

async function main() {
  await seedPlans();
  await seedDemoTenant();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
