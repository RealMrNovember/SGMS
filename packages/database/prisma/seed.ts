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

async function seedSuperAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.sgms.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await hash(adminPassword, 12);

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

  await prisma.organizationMember.deleteMany({
    where: { userId: user.id },
  });

  console.log(`Super Admin ready: ${adminEmail}`);
}

async function seedDemoTenant() {
  if (process.env.SEED_DEMO_TENANT === 'false') {
    return;
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'owner@demo-gym.local';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'Owner123!';

  const starterPlan = await prisma.plan.findUniqueOrThrow({
    where: { code_currency: { code: 'starter', currency: 'TRY' } },
  });

  const passwordHash = await hash(ownerPassword, 12);
  const installationId = randomUUID();

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-gym' },
    update: {
      name: 'Demo Gym',
      email: ownerEmail,
      status: 'ACTIVE',
    },
    create: {
      name: 'Demo Gym',
      slug: 'demo-gym',
      email: ownerEmail,
      country: 'TR',
      installationId,
      status: 'ACTIVE',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: 'Demo Gym Sahibi',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
    },
    create: {
      email: ownerEmail,
      name: 'Demo Gym Sahibi',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      locale: 'tr',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: owner.id,
      },
    },
    update: {
      role: 'OWNER',
      isActive: true,
      joinedAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      userId: owner.id,
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

  console.log(`Demo gym owner ready: ${ownerEmail}`);

  await seedDemoStaff(organization.id);
  await seedGymMembershipPlans(organization.id);
  await seedDemoGymEcosystem(organization.id);
}

async function seedDemoStaff(organizationId: string) {
  const staffEmail = process.env.SEED_STAFF_EMAIL ?? 'staff@demo-gym.local';
  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? 'Staff123!';
  const passwordHash = await hash(staffPassword, 12);

  const staff = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      name: 'Demo Resepsiyon Personeli',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
    },
    create: {
      email: staffEmail,
      name: 'Demo Resepsiyon Personeli',
      passwordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      locale: 'tr',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId: staff.id,
      },
    },
    update: {
      role: 'STAFF',
      isActive: true,
      joinedAt: new Date(),
    },
    create: {
      organizationId,
      userId: staff.id,
      role: 'STAFF',
      isActive: true,
      joinedAt: new Date(),
    },
  });

  console.log(`Demo staff ready: ${staffEmail}`);
}

async function seedDemoGymEcosystem(organizationId: string) {
  const trainerEmail = process.env.SEED_TRAINER_EMAIL ?? 'trainer@demo-gym.local';
  const trainerPassword = process.env.SEED_TRAINER_PASSWORD ?? 'Trainer123!';
  const athleteEmail = process.env.SEED_ATHLETE_EMAIL ?? 'athlete@demo-gym.local';
  const athletePassword = process.env.SEED_ATHLETE_PASSWORD ?? 'Athlete123!';

  const trainerPasswordHash = await hash(trainerPassword, 12);
  const athletePasswordHash = await hash(athletePassword, 12);

  const trainer = await prisma.user.upsert({
    where: { email: trainerEmail },
    update: {
      name: 'Demo PT Antrenör',
      passwordHash: trainerPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
    },
    create: {
      email: trainerEmail,
      name: 'Demo PT Antrenör',
      passwordHash: trainerPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      locale: 'tr',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId: trainer.id,
      },
    },
    update: {
      role: 'TRAINER',
      isActive: true,
      joinedAt: new Date(),
    },
    create: {
      organizationId,
      userId: trainer.id,
      role: 'TRAINER',
      isActive: true,
      joinedAt: new Date(),
    },
  });

  const athleteUser = await prisma.user.upsert({
    where: { email: athleteEmail },
    update: {
      name: 'Ayşe Yılmaz',
      passwordHash: athletePasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
    },
    create: {
      email: athleteEmail,
      name: 'Ayşe Yılmaz',
      passwordHash: athletePasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      locale: 'tr',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId: athleteUser.id,
      },
    },
    update: {
      role: 'VIEWER',
      isActive: true,
      joinedAt: new Date(),
    },
    create: {
      organizationId,
      userId: athleteUser.id,
      role: 'VIEWER',
      isActive: true,
      joinedAt: new Date(),
    },
  });

  const membershipPlan = await prisma.gymMembershipPlan.findFirstOrThrow({
    where: { organizationId, name: '1 Aylık Sınırsız' },
  });

  const gymMember = await prisma.gymMember.upsert({
    where: {
      organizationId_nationalId: {
        organizationId,
        nationalId: '12345678901',
      },
    },
    update: {
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      email: athleteEmail,
      phone: '+905551112233',
      trainerId: trainer.id,
      userId: athleteUser.id,
      planId: membershipPlan.id,
      status: 'ACTIVE',
      gender: 'FEMALE',
      birthDate: new Date('1998-04-12'),
      membershipStartsAt: new Date(),
      membershipEndsAt: new Date(Date.now() + membershipPlan.durationDays * 24 * 60 * 60 * 1000),
    },
    create: {
      organizationId,
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      nationalId: '12345678901',
      email: athleteEmail,
      phone: '+905551112233',
      trainerId: trainer.id,
      userId: athleteUser.id,
      planId: membershipPlan.id,
      status: 'ACTIVE',
      gender: 'FEMALE',
      birthDate: new Date('1998-04-12'),
      membershipStartsAt: new Date(),
      membershipEndsAt: new Date(Date.now() + membershipPlan.durationDays * 24 * 60 * 60 * 1000),
    },
  });

  const existingMeasurement = await prisma.healthMeasurement.findFirst({
    where: { organizationId, gymMemberId: gymMember.id },
    orderBy: { measuredAt: 'desc' },
  });

  if (!existingMeasurement) {
    await prisma.healthMeasurement.create({
      data: {
        organizationId,
        gymMemberId: gymMember.id,
        weight: 62.5,
        bodyFatPercentage: 24.2,
        muscleMass: 28.4,
        height: 168,
        notes: 'İlk demo ölçüm — seed',
        measuredAt: new Date(),
      },
    });
  }

  const existingProgram = await prisma.trainingProgram.findFirst({
    where: {
      organizationId,
      gymMemberId: gymMember.id,
      title: 'Haftalık Üst Vücut Programı',
    },
  });

  if (!existingProgram) {
    await prisma.trainingProgram.create({
      data: {
        organizationId,
        gymMemberId: gymMember.id,
        trainerId: trainer.id,
        title: 'Haftalık Üst Vücut Programı',
        type: 'WORKOUT',
        content: {
          days: [
            {
              name: 'Pazartesi',
              exercises: [
                { name: 'Bench Press', sets: 4, reps: 10 },
                { name: 'Lat Pulldown', sets: 3, reps: 12 },
              ],
            },
            {
              name: 'Çarşamba',
              exercises: [
                { name: 'Shoulder Press', sets: 3, reps: 10 },
                { name: 'Dumbbell Row', sets: 3, reps: 12 },
              ],
            },
          ],
        },
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
  }

  console.log(`Demo ecosystem ready: trainer=${trainerEmail}, athlete=${athleteEmail}`);
}

async function seedGymMembershipPlans(organizationId: string) {
  const plans = [
    {
      name: '1 Aylık Sınırsız',
      description: 'Tüm alanlara 30 gün sınırsız erişim.',
      durationDays: 30,
      price: 999,
      sortOrder: 1,
    },
    {
      name: '3 Aylık Standart',
      description: '90 günlük standart salon üyeliği.',
      durationDays: 90,
      price: 2499,
      sortOrder: 2,
    },
    {
      name: '6 Aylık VIP',
      description: '180 günlük VIP paket — grup dersleri dahil.',
      durationDays: 180,
      price: 4499,
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.gymMembershipPlan.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: plan.name,
        },
      },
      update: {
        description: plan.description,
        durationDays: plan.durationDays,
        price: plan.price,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: {
        organizationId,
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays,
        price: plan.price,
        sortOrder: plan.sortOrder,
        currency: 'TRY',
      },
    });
  }

  console.log(`Seeded ${plans.length} gym membership plans for demo-gym.`);
}

async function main() {
  await seedPlans();
  await seedSuperAdmin();
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
