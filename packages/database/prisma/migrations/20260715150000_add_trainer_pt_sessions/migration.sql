-- PT (Personal Trainer) performans, komisyon ve prim yönetimi (Faz 21).

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRAINER_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PT_SESSION_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PT_SESSION_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PT_SESSION_CANCELED';

-- CreateEnum
CREATE TYPE "PtCommissionModel" AS ENUM ('FIXED_PER_SESSION', 'PERCENTAGE_OF_REVENUE', 'TIERED');

-- CreateEnum
CREATE TYPE "PtSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED_BY_MEMBER', 'CANCELED_BY_TRAINER', 'NO_SHOW');

-- CreateTable
CREATE TABLE "trainer_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "commission_model" "PtCommissionModel" NOT NULL DEFAULT 'FIXED_PER_SESSION',
    "base_commission_rate" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_profiles_organization_id_user_id_key" ON "trainer_profiles"("organization_id", "user_id");
CREATE INDEX "trainer_profiles_organization_id_is_active_idx" ON "trainer_profiles"("organization_id", "is_active");

-- AddForeignKey
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "pt_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "trainer_user_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "PtSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "revenue_amount" DECIMAL(10,2),
    "commission_amount" DECIMAL(10,2),
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pt_sessions_organization_id_trainer_user_id_scheduled_at_idx" ON "pt_sessions"("organization_id", "trainer_user_id", "scheduled_at");
CREATE INDEX "pt_sessions_organization_id_gym_member_id_idx" ON "pt_sessions"("organization_id", "gym_member_id");
CREATE INDEX "pt_sessions_organization_id_status_idx" ON "pt_sessions"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_trainer_user_id_fkey" FOREIGN KEY ("trainer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
