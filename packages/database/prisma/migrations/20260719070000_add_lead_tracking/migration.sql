-- Faz 17.0: potansiyel müşteri (Lead) takibi

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadFollowUpMethod" AS ENUM ('CALL', 'MESSAGE', 'EMAIL');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_CONVERTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_FOLLOW_UP_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_FOLLOW_UP_COMPLETED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WALK_IN',
    "interested_plan" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "converted_member_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "lost_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_follow_ups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "method" "LeadFollowUpMethod" NOT NULL DEFAULT 'CALL',
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "leads_converted_member_id_key" ON "leads"("converted_member_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_organization_id_status_idx" ON "leads"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_organization_id_assigned_to_id_idx" ON "leads"("organization_id", "assigned_to_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_follow_ups_organization_id_scheduled_at_idx" ON "lead_follow_ups"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_follow_ups_lead_id_scheduled_at_idx" ON "lead_follow_ups"("lead_id", "scheduled_at");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "gym_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
