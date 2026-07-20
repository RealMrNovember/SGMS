-- Faz 8.7.1: Sporcu portalinda/mobilde kendi kartiyla uyelik yenileme
--
-- tenant_checkout_sessions'a, odeme onaylaninca uyelik tarihlerini uzatmak
-- icin gereken alanlar eklendi. Bos birakilirsa (Faz 8.7'nin genel "acik
-- bakiyeyi ode" akisi) davranis degismez.

ALTER TABLE "tenant_checkout_sessions" ADD COLUMN IF NOT EXISTS "renewal_plan_id" TEXT;
ALTER TABLE "tenant_checkout_sessions" ADD COLUMN IF NOT EXISTS "renewal_membership_starts_at" TIMESTAMP(3);
ALTER TABLE "tenant_checkout_sessions" ADD COLUMN IF NOT EXISTS "renewal_membership_ends_at" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "tenant_checkout_sessions" ADD CONSTRAINT "tenant_checkout_sessions_renewal_plan_id_fkey" FOREIGN KEY ("renewal_plan_id") REFERENCES "gym_membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
