-- Faz 36.11: cihaz DRAINING durumu + proforma e-posta durum alanları

ALTER TYPE "DeviceStatus" ADD VALUE IF NOT EXISTS 'DRAINING';

ALTER TABLE "proforma_tokens"
  ADD COLUMN IF NOT EXISTS "email_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "email_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_email_error" TEXT;

CREATE INDEX IF NOT EXISTS "proforma_tokens_billing_request_id_idx" ON "proforma_tokens"("billing_request_id");
CREATE INDEX IF NOT EXISTS "proforma_tokens_email_status_idx" ON "proforma_tokens"("email_status");
