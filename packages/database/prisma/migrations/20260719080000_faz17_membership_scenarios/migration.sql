-- Faz 17: üyelik senaryoları (dondurma, devir, grup, ders, indirim, misafir)

-- AlterEnum: AuditAction (üyelik / ders / indirim / misafir)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_FREEZE_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_FREEZE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_FREEZE_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_TRANSFER_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_RIGHTS_CREDITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_GROUP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_GROUP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLASS_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLASS_SESSION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLASS_BOOKING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLASS_BOOKING_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLASS_ATTENDANCE_MARKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCOUNT_CODE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCOUNT_CODE_REDEEMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_PASS_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_PASS_REVOKED';

ALTER TYPE "GymMemberStatus" ADD VALUE IF NOT EXISTS 'FROZEN';
ALTER TYPE "AccessSubjectType" ADD VALUE IF NOT EXISTS 'GUEST';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MembershipFreezeReason" AS ENUM ('MILITARY', 'MEDICAL', 'TRAVEL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MembershipFreezeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MembershipGroupType" AS ENUM ('INDIVIDUAL', 'COUPLE', 'FAMILY', 'CORPORATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ClassBookingStatus" AS ENUM ('BOOKED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable: expense_categories (stok alanları)
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "stock_quantity" INTEGER;
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "low_stock_threshold" INTEGER;

-- AlterTable: gym_members (grup / veli)
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "membership_group_id" TEXT;
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "guardian_name" TEXT;
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "guardian_phone" TEXT;
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "guardian_consent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "gym_members_membership_group_id_idx" ON "gym_members"("membership_group_id");

-- AlterTable: check_ins (ders / misafir — FK tablolar oluştuktan sonra)
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "class_session_id" TEXT;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "guest_pass_id" TEXT;

CREATE INDEX IF NOT EXISTS "check_ins_class_session_id_idx" ON "check_ins"("class_session_id");
CREATE INDEX IF NOT EXISTS "check_ins_guest_pass_id_idx" ON "check_ins"("guest_pass_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "membership_freezes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" "MembershipFreezeReason" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "status" "MembershipFreezeStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT,
    "approved_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "days_extended" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_freezes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_transfers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_member_id" TEXT NOT NULL,
    "to_member_id" TEXT NOT NULL,
    "remaining_days" INTEGER NOT NULL,
    "plan_id" TEXT,
    "notes" TEXT,
    "approved_by_id" TEXT NOT NULL,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credit_amount" DECIMAL(10,2),
    "credit_currency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_groups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MembershipGroupType" NOT NULL DEFAULT 'FAMILY',
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "company_name" TEXT,
    "billing_notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gym_classes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trainer_id" TEXT,
    "room_name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 15,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "weekly_days" INTEGER[] NOT NULL,
    "start_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_class_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "trainer_id" TEXT,
    "room_name" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "class_bookings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "status" "ClassBookingStatus" NOT NULL DEFAULT 'BOOKED',
    "waitlist_pos" INTEGER,
    "promoted_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "discount_codes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "discount_redemptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "discount_code_id" TEXT NOT NULL,
    "gym_member_id" TEXT,
    "amount_saved" DECIMAL(10,2) NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "guest_passes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "host_member_id" TEXT,
    "issued_by_id" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "qr_token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "membership_freezes_organization_id_status_idx" ON "membership_freezes"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "membership_freezes_gym_member_id_status_idx" ON "membership_freezes"("gym_member_id", "status");

CREATE INDEX IF NOT EXISTS "membership_transfers_organization_id_transferred_at_idx" ON "membership_transfers"("organization_id", "transferred_at");
CREATE INDEX IF NOT EXISTS "membership_transfers_from_member_id_idx" ON "membership_transfers"("from_member_id");
CREATE INDEX IF NOT EXISTS "membership_transfers_to_member_id_idx" ON "membership_transfers"("to_member_id");

CREATE INDEX IF NOT EXISTS "membership_groups_organization_id_type_idx" ON "membership_groups"("organization_id", "type");

CREATE INDEX IF NOT EXISTS "gym_classes_organization_id_is_active_idx" ON "gym_classes"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "gym_classes_trainer_id_idx" ON "gym_classes"("trainer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "class_sessions_gym_class_id_starts_at_key" ON "class_sessions"("gym_class_id", "starts_at");
CREATE INDEX IF NOT EXISTS "class_sessions_organization_id_starts_at_idx" ON "class_sessions"("organization_id", "starts_at");
CREATE INDEX IF NOT EXISTS "class_sessions_gym_class_id_starts_at_idx" ON "class_sessions"("gym_class_id", "starts_at");

CREATE UNIQUE INDEX IF NOT EXISTS "class_bookings_class_session_id_gym_member_id_key" ON "class_bookings"("class_session_id", "gym_member_id");
CREATE INDEX IF NOT EXISTS "class_bookings_organization_id_status_idx" ON "class_bookings"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "class_bookings_gym_member_id_created_at_idx" ON "class_bookings"("gym_member_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_organization_id_code_key" ON "discount_codes"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "discount_codes_code_idx" ON "discount_codes"("code");
CREATE INDEX IF NOT EXISTS "discount_codes_organization_id_is_active_idx" ON "discount_codes"("organization_id", "is_active");

CREATE INDEX IF NOT EXISTS "discount_redemptions_organization_id_created_at_idx" ON "discount_redemptions"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "discount_redemptions_discount_code_id_idx" ON "discount_redemptions"("discount_code_id");

CREATE UNIQUE INDEX IF NOT EXISTS "guest_passes_qr_token_hash_key" ON "guest_passes"("qr_token_hash");
CREATE INDEX IF NOT EXISTS "guest_passes_organization_id_valid_until_idx" ON "guest_passes"("organization_id", "valid_until");
CREATE INDEX IF NOT EXISTS "guest_passes_host_member_id_idx" ON "guest_passes"("host_member_id");

-- AddForeignKey: membership_freezes
DO $$ BEGIN
    ALTER TABLE "membership_freezes" ADD CONSTRAINT "membership_freezes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_freezes" ADD CONSTRAINT "membership_freezes_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_freezes" ADD CONSTRAINT "membership_freezes_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_freezes" ADD CONSTRAINT "membership_freezes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: membership_transfers
DO $$ BEGIN
    ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "gym_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "gym_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gym_membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: membership_groups
DO $$ BEGIN
    ALTER TABLE "membership_groups" ADD CONSTRAINT "membership_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "membership_groups" ADD CONSTRAINT "membership_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: gym_classes
DO $$ BEGIN
    ALTER TABLE "gym_classes" ADD CONSTRAINT "gym_classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "gym_classes" ADD CONSTRAINT "gym_classes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "gym_classes" ADD CONSTRAINT "gym_classes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: class_sessions
DO $$ BEGIN
    ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_gym_class_id_fkey" FOREIGN KEY ("gym_class_id") REFERENCES "gym_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: class_bookings
DO $$ BEGIN
    ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: discount_codes
DO $$ BEGIN
    ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: discount_redemptions
DO $$ BEGIN
    ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: guest_passes
DO $$ BEGIN
    ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_host_member_id_fkey" FOREIGN KEY ("host_member_id") REFERENCES "gym_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: check_ins -> class_sessions, guest_passes
DO $$ BEGIN
    ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_guest_pass_id_fkey" FOREIGN KEY ("guest_pass_id") REFERENCES "guest_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey: gym_members -> membership_groups
DO $$ BEGIN
    ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_membership_group_id_fkey" FOREIGN KEY ("membership_group_id") REFERENCES "membership_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
