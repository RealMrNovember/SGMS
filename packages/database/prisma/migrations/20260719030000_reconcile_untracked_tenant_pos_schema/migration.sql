-- Bu migration, 2026-07-19 deploy'unda keşfedilen "untracked" durumu şemaya
-- resmi olarak kaydeder: production'da bu repoya hiç commit edilmemiş bir
-- tenant-seviyeli POS/fatura/ödeme-ağgeçidi çalışması (muhtemelen başka bir
-- oturumdan `db push` ile) doğrudan uygulanmıştı. Aşağıdaki CREATE TABLE/TYPE
-- ifadeleri idempotent yazıldı (IF NOT EXISTS / duplicate_object yakalama) —
-- production'da zaten var olan nesnelere dokunmadan sorunsuz çalışır, sıfırdan
-- bir ortamda da doğru şekilde oluşturur. Yalnızca gerçekten eksik olan enum
-- değerleri ve kolon kısıtları (aşağıda ayrıca belirtildi) fiilen değişiyor.

-- ============================================================
-- 1) Zaten production'da var olan (başka bir çalışmadan), ama bu repoda hiç
--    tanımlı olmayan enum'lar — idempotent oluşturma.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "GymAccessStatus" AS ENUM ('SUCCESS', 'DENIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "GymMemberActivityType" AS ENUM ('CHECK_IN', 'CHECK_OUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'CANCELLED', 'PARTIALLY_PAID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('MESSAGE', 'PROGRAM', 'PAYMENT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentProviderType" AS ENUM ('MANUAL', 'STRIPE', 'PAYPAL', 'IYZICO', 'PAYTR', 'MOKA', 'PARAM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 2) Gerçekten eksik/yanlış olan enum değerleri — bunlar fiilen değişiyor.
-- ============================================================

-- OrganizationStatus'a production'da zaten kullanılan (ama bu repoda tanımsız) TRIAL değeri ekleniyor.
ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'TRIAL';

-- TransactionType'da CHARGE/ADJUSTMENT eksikti (Faz 8 POS/gider kaydı bu değerlere ihtiyaç duyuyor,
-- muhtemelen başka çalışma sırasında yanlışlıkla düşürülmüş — bkz. ayrı prod-bug takip görevi).
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CHARGE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- PaymentMethod, başka çalışma tarafından (CASH, CREDIT_CARD, BALANCE) olarak değiştirilmişti;
-- bu repodaki (ve zaten çalışan expense/POS kodundaki) beklenen değerlere geri döndürülüyor.
-- `transactions` ve `payment_intents` tabloları bu migration anında boş olduğu için veri kaybı yok.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentMethod' AND e.enumlabel IN ('CREDIT_CARD', 'BALANCE')
  ) THEN
    ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');
    ALTER TABLE "transactions" ALTER COLUMN "payment_method" DROP DEFAULT;
    ALTER TABLE "transactions" ALTER COLUMN "payment_method" TYPE "PaymentMethod" USING (NULL);
    ALTER TABLE "payment_intents" ALTER COLUMN "method" TYPE "PaymentMethod" USING (NULL);
    DROP TYPE "PaymentMethod_old";
  END IF;
END $$;

-- ============================================================
-- 3) Zaten var olan tabloların şeması — idempotent oluşturma.
-- ============================================================

CREATE TABLE IF NOT EXISTS "tenant_payment_gateways" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "api_key" TEXT,
    "secret_key" TEXT,
    "merchant_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_payment_gateways_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "stock" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "member_cards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "card_alias" TEXT NOT NULL,
    "payment_token" TEXT NOT NULL,
    "brand" TEXT,
    "last_four" TEXT,
    "expiry_month" INTEGER,
    "expiry_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "member_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_intents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "requested_amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gym_access_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT,
    "device_id" TEXT,
    "terminal_id" TEXT NOT NULL,
    "access_time" TIMESTAMP(3) NOT NULL,
    "status" "GymAccessStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gym_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gym_member_activities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "type" "GymMemberActivityType" NOT NULL DEFAULT 'CHECK_IN',
    "activity_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "terminal_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gym_member_activities_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4) transactions tablosuna diğer çalışmadan gelen ek kolonlar — idempotent.
-- ============================================================

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "gateway_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "gateway_transaction_id" TEXT;

-- payment_method / created_by_id her zaman uygulama kodu tarafından dolduruluyor
-- (bkz. actions/expenses.ts, api/v1/transactions/route.ts) ve tablo şu an boş —
-- bu yüzden NOT NULL'a çevirmek güvenli.
ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "created_by_id" SET NOT NULL;

-- ============================================================
-- 5) Indexler ve foreign key'ler — idempotent.
-- ============================================================

CREATE INDEX IF NOT EXISTS "tenant_payment_gateways_organization_id_is_active_idx" ON "tenant_payment_gateways"("organization_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_gateways_organization_id_provider_key" ON "tenant_payment_gateways"("organization_id", "provider");

CREATE INDEX IF NOT EXISTS "products_organization_id_is_active_sort_order_idx" ON "products"("organization_id", "is_active", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "products_organization_id_name_key" ON "products"("organization_id", "name");

CREATE INDEX IF NOT EXISTS "member_cards_organization_id_gym_member_id_idx" ON "member_cards"("organization_id", "gym_member_id");
CREATE INDEX IF NOT EXISTS "member_cards_gym_member_id_is_default_idx" ON "member_cards"("gym_member_id", "is_default");

CREATE INDEX IF NOT EXISTS "invoices_organization_id_gym_member_id_status_created_at_idx" ON "invoices"("organization_id", "gym_member_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "invoices_organization_id_status_created_at_idx" ON "invoices"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "invoices_gym_member_id_created_at_idx" ON "invoices"("gym_member_id", "created_at");

CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx" ON "invoice_items"("product_id");

CREATE INDEX IF NOT EXISTS "payment_intents_organization_id_gym_member_id_status_idx" ON "payment_intents"("organization_id", "gym_member_id", "status");
CREATE INDEX IF NOT EXISTS "payment_intents_organization_id_status_created_at_idx" ON "payment_intents"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payment_intents_gym_member_id_created_at_idx" ON "payment_intents"("gym_member_id", "created_at");

CREATE INDEX IF NOT EXISTS "notifications_organization_id_created_at_idx" ON "notifications"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

CREATE INDEX IF NOT EXISTS "gym_access_logs_organization_id_access_time_idx" ON "gym_access_logs"("organization_id", "access_time");
CREATE INDEX IF NOT EXISTS "gym_access_logs_gym_member_id_access_time_idx" ON "gym_access_logs"("gym_member_id", "access_time");
CREATE INDEX IF NOT EXISTS "gym_access_logs_device_id_access_time_idx" ON "gym_access_logs"("device_id", "access_time");
CREATE INDEX IF NOT EXISTS "gym_access_logs_terminal_id_access_time_idx" ON "gym_access_logs"("terminal_id", "access_time");

CREATE INDEX IF NOT EXISTS "gym_member_activities_organization_id_activity_at_idx" ON "gym_member_activities"("organization_id", "activity_at");
CREATE INDEX IF NOT EXISTS "gym_member_activities_gym_member_id_type_activity_at_idx" ON "gym_member_activities"("gym_member_id", "type", "activity_at");
CREATE INDEX IF NOT EXISTS "gym_member_activities_org_member_activity_idx" ON "gym_member_activities"("organization_id", "gym_member_id", "activity_at");

CREATE INDEX IF NOT EXISTS "transactions_invoice_id_idx" ON "transactions"("invoice_id");
CREATE INDEX IF NOT EXISTS "transactions_gateway_id_idx" ON "transactions"("gateway_id");

DO $$ BEGIN
  ALTER TABLE "tenant_payment_gateways" ADD CONSTRAINT "tenant_payment_gateways_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gym_access_logs" ADD CONSTRAINT "gym_access_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gym_access_logs" ADD CONSTRAINT "gym_access_logs_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gym_access_logs" ADD CONSTRAINT "gym_access_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gym_member_activities" ADD CONSTRAINT "gym_member_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gym_member_activities" ADD CONSTRAINT "gym_member_activities_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "tenant_payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
