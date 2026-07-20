-- Faz 37: gelişmiş vücut ölçümleri + ilerleme fotoğrafları

DO $$ BEGIN
  CREATE TYPE "MeasurementPhotoAngle" AS ENUM ('FRONT', 'SIDE', 'BACK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "waist_cm" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "chest_cm" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "hip_cm" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "arm_cm" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "thigh_cm" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "body_water_percentage" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "visceral_fat_rating" DECIMAL(5,2);
ALTER TABLE "health_measurements" ADD COLUMN IF NOT EXISTS "resting_heart_rate" INTEGER;

CREATE TABLE IF NOT EXISTS "measurement_photos" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "gym_member_id" TEXT NOT NULL,
  "health_measurement_id" TEXT,
  "angle" "MeasurementPhotoAngle" NOT NULL DEFAULT 'OTHER',
  "photo_url" TEXT NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "measurement_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "measurement_photos_organization_id_gym_member_id_taken_at_idx"
  ON "measurement_photos"("organization_id", "gym_member_id", "taken_at");
CREATE INDEX IF NOT EXISTS "measurement_photos_health_measurement_id_idx"
  ON "measurement_photos"("health_measurement_id");

DO $$ BEGIN
  ALTER TABLE "measurement_photos" ADD CONSTRAINT "measurement_photos_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "measurement_photos" ADD CONSTRAINT "measurement_photos_gym_member_id_fkey"
    FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "measurement_photos" ADD CONSTRAINT "measurement_photos_health_measurement_id_fkey"
    FOREIGN KEY ("health_measurement_id") REFERENCES "health_measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "measurement_photos" ADD CONSTRAINT "measurement_photos_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
