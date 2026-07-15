-- Partner (temsilci/referans) portalı + tarayıcı Web Push bildirimleri.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_UNASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_DISCOUNT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_CAPACITY_ADJUSTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTNER_TRIAL_EXTENDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PUSH_SUBSCRIBED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PUSH_UNSUBSCRIBED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_partner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_user_id_key" ON "partners"("user_id");
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");
CREATE INDEX "partners_is_active_idx" ON "partners"("is_active");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (organizations — partner ataması + ek kapasite)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "partner_id" TEXT,
  ADD COLUMN IF NOT EXISTS "extra_member_capacity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "extra_staff_capacity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "extra_device_capacity" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "organizations_partner_id_idx" ON "organizations"("partner_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable (subscriptions — temsilciye özel indirim)
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "partner_discount_percent" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "partner_discount_note" TEXT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
