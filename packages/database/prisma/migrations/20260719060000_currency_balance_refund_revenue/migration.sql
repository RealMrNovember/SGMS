-- Faz 36.2 / 36.9: iade ilişkisi + REFUND_RECORDED audit

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFUND_RECORDED';

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "refund_of_transaction_id" TEXT;

CREATE INDEX IF NOT EXISTS "transactions_refund_of_transaction_id_idx"
  ON "transactions"("refund_of_transaction_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_refund_of_transaction_id_fkey'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_refund_of_transaction_id_fkey"
      FOREIGN KEY ("refund_of_transaction_id") REFERENCES "transactions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
