-- CreateEnum
CREATE TYPE "GymMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_REGISTERED';

-- CreateTable
CREATE TABLE "gym_membership_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_days" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "national_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "birth_date" DATE,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "status" "GymMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "membership_starts_at" TIMESTAMP(3),
    "membership_ends_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_membership_plans_organization_id_is_active_sort_order_idx" ON "gym_membership_plans"("organization_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "gym_membership_plans_organization_id_name_key" ON "gym_membership_plans"("organization_id", "name");

-- CreateIndex
CREATE INDEX "gym_members_organization_id_status_idx" ON "gym_members"("organization_id", "status");

-- CreateIndex
CREATE INDEX "gym_members_organization_id_last_name_first_name_idx" ON "gym_members"("organization_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "gym_members_phone_idx" ON "gym_members"("phone");

-- CreateIndex
CREATE INDEX "gym_members_email_idx" ON "gym_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "gym_members_organization_id_national_id_key" ON "gym_members"("organization_id", "national_id");

-- AddForeignKey
ALTER TABLE "gym_membership_plans" ADD CONSTRAINT "gym_membership_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gym_membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
