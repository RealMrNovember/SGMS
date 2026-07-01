-- Legacy production rows used OrganizationStatus = 'TRIAL' (invalid in Prisma schema).
-- Trial state belongs on subscriptions.status (TRIALING) and central_license_status (TRIAL).
UPDATE "organizations"
SET "status" = 'ACTIVE'
WHERE "status"::text = 'TRIAL';
