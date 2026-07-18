-- Bu migration KASITLI olarak yalnızca ekleyici (additive) işlemler içerir.
-- `prisma migrate diff --from-url` ile production'a karşı otomatik üretilen ham
-- diff, bu repoda hiç tanımlı olmayan (tenant_payment_gateways, products,
-- member_cards, invoices, notifications, gym_access_logs, gym_member_activities,
-- invoice_items) tabloları ve bunlara bağlı transactions.gateway_id/invoice_id
-- kolonlarını DROP eden komutlar da içeriyordu — bu tablolarda gerçek veri var
-- (products: 4, tenant_payment_gateways: 3, member_cards: 1 satır) ve hiçbir
-- deploy edilmiş kod bunlara referans vermiyor; büyük olasılıkla ayrı bir
-- oturumda doğrudan production'a `db push` ile eklenmiş, hiç commit edilmemiş
-- bir çalışma. Veri kaybı riskine girmemek için o kısımlar elden çıkarıldı ve
-- bu migration yalnızca aşağıdaki, tamamen yeni ve güvenli eklemeleri içerir.

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('NONE', 'IYZICO', 'PAYTR');

-- AlterEnum (yalnızca değer ekleniyor, mevcut satırlara dokunmaz)
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_PAYMENT_SETTINGS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'TWO_FACTOR_BACKUP_CODES_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_INVITE_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_INVITE_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROFORMA_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBERSHIP_REMINDER_SENT';

-- AlterTable
ALTER TABLE "gym_members" ADD COLUMN "last_reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "totp_secret" TEXT,
ADD COLUMN "two_factor_enabled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invite_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "active_gateway" "PaymentGateway" NOT NULL DEFAULT 'NONE',
    "iyzico_api_key" TEXT,
    "iyzico_secret_key" TEXT,
    "iyzico_base_url" TEXT NOT NULL DEFAULT 'https://sandbox-api.iyzipay.com',
    "iyzico_sandbox" BOOLEAN NOT NULL DEFAULT true,
    "paytr_merchant_id" TEXT,
    "paytr_merchant_key" TEXT,
    "paytr_merchant_salt" TEXT,
    "paytr_sandbox" BOOLEAN NOT NULL DEFAULT true,
    "bank_transfer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "iban_holder_name" TEXT,
    "iban_number" TEXT,
    "iban_bank_name" TEXT,
    "bank_transfer_note" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_checkout_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "billing_request_id" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "billing_request_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proforma_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_user_id_idx" ON "two_factor_backup_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invite_tokens_token_hash_key" ON "staff_invite_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "staff_invite_tokens_user_id_idx" ON "staff_invite_tokens"("user_id");

-- CreateIndex
CREATE INDEX "staff_invite_tokens_expires_at_idx" ON "staff_invite_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "gateway_checkout_sessions_organization_id_idx" ON "gateway_checkout_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "proforma_tokens_token_hash_key" ON "proforma_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "proforma_tokens_organization_id_idx" ON "proforma_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "proforma_tokens_expires_at_idx" ON "proforma_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invite_tokens" ADD CONSTRAINT "staff_invite_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_checkout_sessions" ADD CONSTRAINT "gateway_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_tokens" ADD CONSTRAINT "proforma_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
