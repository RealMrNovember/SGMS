-- Faz 8.7: Salon Bazlı Online Ödeme Sağlayıcı Entegrasyonu (Iyzico/PayTR/Banka Havalesi)
--
-- `tenant_payment_gateways` tablosu daha önce başka bir oturumda commit edilmeden
-- production'a eklenmişti (bkz. 20260719030000_reconcile_untracked_tenant_pos_schema).
-- Bu migration o tabloyu Faz 16.3'teki (PlatformPaymentSettings) alan setiyle
-- hizalıyor ve tenant-seviyeli checkout takibi için yeni bir tablo ekliyor.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TENANT_PAYMENT_GATEWAY_CONFIGURED';
ALTER TYPE "PaymentProviderType" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "merchant_key" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "merchant_salt" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "base_url" TEXT NOT NULL DEFAULT 'https://sandbox-api.iyzipay.com';
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "sandbox" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "iban_holder_name" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "iban_number" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "iban_bank_name" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "bank_transfer_note" TEXT;
ALTER TABLE "tenant_payment_gateways" ADD COLUMN IF NOT EXISTS "updated_by_id" TEXT;

CREATE TABLE IF NOT EXISTS "tenant_checkout_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "expense_id" TEXT,
    "gateway_id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tenant_checkout_sessions_organization_id_gym_member_id_idx" ON "tenant_checkout_sessions"("organization_id", "gym_member_id");
CREATE INDEX IF NOT EXISTS "tenant_checkout_sessions_gateway_id_idx" ON "tenant_checkout_sessions"("gateway_id");
CREATE INDEX IF NOT EXISTS "tenant_checkout_sessions_expense_id_status_idx" ON "tenant_checkout_sessions"("expense_id", "status");

DO $$ BEGIN
  ALTER TABLE "tenant_checkout_sessions" ADD CONSTRAINT "tenant_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_checkout_sessions" ADD CONSTRAINT "tenant_checkout_sessions_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_checkout_sessions" ADD CONSTRAINT "tenant_checkout_sessions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_checkout_sessions" ADD CONSTRAINT "tenant_checkout_sessions_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "tenant_payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
