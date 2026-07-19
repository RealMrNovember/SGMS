-- Faz 18 + 18.1 + 22 + 23 + 25

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_EXPORT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HEALTH_CONSENT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONTRACT_TEMPLATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONTRACT_PDF_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAVE_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAVE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAVE_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHIFT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHIFT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERFORMANCE_REVIEW_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DISCIPLINARY_RECORD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_COMPENSATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_ISSUE_REPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_SERVICE_LOGGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MAINTENANCE_SCHEDULE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CASH_SHIFT_OPENED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CASH_SHIFT_CLOSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CASH_X_REPORT';

DO $$ BEGIN CREATE TYPE "AccountDeletionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ContractTemplateType" AS ENUM ('MEMBERSHIP', 'RISK_WAIVER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'EXCUSED', 'MEDICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EquipmentCategory" AS ENUM ('CARDIO', 'STRENGTH', 'GROUP_CLASS', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EquipmentStatus" AS ENUM ('OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MaintenanceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "base_salary" DECIMAL(12,2);
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "bonus_summary" TEXT;

ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "health_consent_accepted_at" TIMESTAMP(3);
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "health_consent_accepted_by_id" TEXT;
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "health_consent_version" TEXT;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issued_by_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cash_register_shift_id" TEXT;
CREATE INDEX IF NOT EXISTS "transactions_cash_register_shift_id_idx" ON "transactions"("cash_register_shift_id");

CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "reason" TEXT,
  "status" "AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "account_deletion_requests_organization_id_status_created_at_idx" ON "account_deletion_requests"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "account_deletion_requests_status_created_at_idx" ON "account_deletion_requests"("status", "created_at");

CREATE TABLE IF NOT EXISTS "contract_templates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ContractTemplateType" NOT NULL DEFAULT 'MEMBERSHIP',
  "body_text" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contract_templates_organization_id_type_is_active_idx" ON "contract_templates"("organization_id", "type", "is_active");

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "reason" TEXT,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "leave_requests_organization_id_status_start_date_idx" ON "leave_requests"("organization_id", "status", "start_date");
CREATE INDEX IF NOT EXISTS "leave_requests_user_id_start_date_idx" ON "leave_requests"("user_id", "start_date");

CREATE TABLE IF NOT EXISTS "shifts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shifts_organization_id_day_of_week_is_active_idx" ON "shifts"("organization_id", "day_of_week", "is_active");

CREATE TABLE IF NOT EXISTS "shift_assignments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "shift_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "week_start_date" DATE,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignments_shift_id_user_id_week_start_date_key" ON "shift_assignments"("shift_id", "user_id", "week_start_date");
CREATE INDEX IF NOT EXISTS "shift_assignments_organization_id_user_id_idx" ON "shift_assignments"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "shift_assignments_organization_id_week_start_date_idx" ON "shift_assignments"("organization_id", "week_start_date");

CREATE TABLE IF NOT EXISTS "performance_reviews" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subject_user_id" TEXT NOT NULL,
  "reviewer_id" TEXT NOT NULL,
  "period_label" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "notes" TEXT NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "performance_reviews_organization_id_subject_user_id_reviewed_at_idx" ON "performance_reviews"("organization_id", "subject_user_id", "reviewed_at");

CREATE TABLE IF NOT EXISTS "disciplinary_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "subject_user_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disciplinary_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "disciplinary_records_organization_id_subject_user_id_occurred_at_idx" ON "disciplinary_records"("organization_id", "subject_user_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "gym_equipment" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "EquipmentCategory" NOT NULL DEFAULT 'OTHER',
  "status" "EquipmentStatus" NOT NULL DEFAULT 'OPERATIONAL',
  "serial_number" TEXT,
  "purchase_date" DATE,
  "purchase_price" DECIMAL(12,2),
  "warranty_expires_at" DATE,
  "location" TEXT,
  "photo_url" TEXT,
  "qr_token_hash" TEXT NOT NULL,
  "public_code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gym_equipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "gym_equipment_qr_token_hash_key" ON "gym_equipment"("qr_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "gym_equipment_public_code_key" ON "gym_equipment"("public_code");
CREATE INDEX IF NOT EXISTS "gym_equipment_organization_id_status_idx" ON "gym_equipment"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "gym_equipment_organization_id_category_idx" ON "gym_equipment"("organization_id", "category");

CREATE TABLE IF NOT EXISTS "equipment_service_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "equipment_id" TEXT NOT NULL,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reported_by_id" TEXT NOT NULL,
  "issue_description" TEXT NOT NULL,
  "service_provider" TEXT,
  "service_date" DATE,
  "cost" DECIMAL(12,2),
  "warranty_claim" BOOLEAN NOT NULL DEFAULT false,
  "photo_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_service_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "equipment_service_logs_organization_id_equipment_id_reported_at_idx" ON "equipment_service_logs"("organization_id", "equipment_id", "reported_at");

CREATE TABLE IF NOT EXISTS "maintenance_schedules" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "equipment_id" TEXT,
  "title" TEXT NOT NULL,
  "frequency" "MaintenanceFrequency" NOT NULL DEFAULT 'MONTHLY',
  "next_due_date" DATE NOT NULL,
  "last_done_at" DATE,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "maintenance_schedules_organization_id_next_due_date_is_active_idx" ON "maintenance_schedules"("organization_id", "next_due_date", "is_active");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_equipment_id_idx" ON "maintenance_schedules"("equipment_id");

CREATE TABLE IF NOT EXISTS "cash_register_shifts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "opened_by_id" TEXT NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opening_balance" DECIMAL(12,2) NOT NULL,
  "closed_by_id" TEXT,
  "closed_at" TIMESTAMP(3),
  "closing_balance_expected" DECIMAL(12,2),
  "closing_balance_counted" DECIMAL(12,2),
  "discrepancy" DECIMAL(12,2),
  "notes" TEXT,
  "report_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_register_shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cash_register_shifts_organization_id_opened_at_idx" ON "cash_register_shifts"("organization_id", "opened_at");
CREATE INDEX IF NOT EXISTS "cash_register_shifts_organization_id_closed_at_idx" ON "cash_register_shifts"("organization_id", "closed_at");

DO $$ BEGIN ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_health_consent_accepted_by_id_fkey" FOREIGN KEY ("health_consent_accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_register_shift_id_fkey" FOREIGN KEY ("cash_register_shift_id") REFERENCES "cash_register_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "gym_equipment" ADD CONSTRAINT "gym_equipment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "equipment_service_logs" ADD CONSTRAINT "equipment_service_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "equipment_service_logs" ADD CONSTRAINT "equipment_service_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "gym_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "equipment_service_logs" ADD CONSTRAINT "equipment_service_logs_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "gym_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
