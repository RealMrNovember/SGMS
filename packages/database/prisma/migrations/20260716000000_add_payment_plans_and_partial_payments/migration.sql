-- Faz 8.6: Ödeme planı / taksitli tahsilat + kısmi ödeme desteği
-- Additive only: mevcut Expense/Transaction cari hesap mantığına dokunmaz.

-- 1) AuditAction enum genişletmesi
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_PLAN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_PLAN_CANCELLED';

-- 2) Yeni PaymentPlanStatus enum
CREATE TYPE "PaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- 3) PaymentPlan tablosu
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "description" TEXT,
    "installment_count" INTEGER NOT NULL,
    "status" "PaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_plans_organization_id_gym_member_id_status_idx" ON "payment_plans"("organization_id", "gym_member_id", "status");

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_gym_member_id_fkey"
  FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_plans"
  ADD CONSTRAINT "payment_plans_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Expense tablosuna vade tarihi, kısmi ödeme takibi ve plan bağlantısı
ALTER TABLE "expenses" ADD COLUMN "due_date" TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN "payment_plan_id" TEXT;

CREATE INDEX "expenses_organization_id_status_due_date_idx" ON "expenses"("organization_id", "status", "due_date");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_payment_plan_id_fkey"
  FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
