-- Faz 42: antrenör atama / değişiklik talebi

ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "max_members" INTEGER;

DO $$ BEGIN
  CREATE TYPE "TrainerRequestType" AS ENUM ('ASSIGN', 'CHANGE', 'REMOVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TrainerRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "trainer_requests" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "gym_member_id" TEXT NOT NULL,
  "request_type" "TrainerRequestType" NOT NULL,
  "preferred_trainer_id" TEXT,
  "reason" TEXT,
  "status" "TrainerRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_id" TEXT NOT NULL,
  "decided_by_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "resulting_trainer_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trainer_requests_organization_id_status_created_at_idx"
  ON "trainer_requests"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "trainer_requests_gym_member_id_status_idx"
  ON "trainer_requests"("gym_member_id", "status");

DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_gym_member_id_fkey"
  FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_preferred_trainer_id_fkey"
  FOREIGN KEY ("preferred_trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "trainer_requests" ADD CONSTRAINT "trainer_requests_resulting_trainer_id_fkey"
  FOREIGN KEY ("resulting_trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
