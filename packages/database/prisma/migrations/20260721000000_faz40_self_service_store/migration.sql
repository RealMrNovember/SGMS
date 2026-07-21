-- Faz 40 — Sporcu Self-Servis Mağaza
-- ExpenseCategory: mobil mağaza görünürlüğü + ürün fotoğrafı
ALTER TABLE "expense_categories" ADD COLUMN "image_url" TEXT;
ALTER TABLE "expense_categories" ADD COLUMN "is_store_visible" BOOLEAN NOT NULL DEFAULT false;

-- Expense: online mağaza siparişi teslim durumu
ALTER TABLE "expenses" ADD COLUMN "delivered_at" TIMESTAMP(3);

-- TenantCheckoutSession: sepetteki birden çok Expense'i tek checkout'a bağlamak için
ALTER TABLE "tenant_checkout_sessions" ADD COLUMN "store_expense_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
