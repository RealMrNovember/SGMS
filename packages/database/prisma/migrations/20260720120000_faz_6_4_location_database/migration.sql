-- Faz 6.4: Kuresel Lokasyon Veritabani (Ulke - Sehir - Ilce)
-- Not: migration dosyalarinda ASCII-guvenli metin kullanilir (bazi ortamlarda
-- sunucu encoding'i UTF8 disinda olabiliyor, ozel unicode karakterler hataya yol acar).

CREATE TABLE IF NOT EXISTS "countries" (
    "id" TEXT NOT NULL,
    "iso_code" TEXT NOT NULL,
    "calling_code" TEXT,
    "has_districts" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "countries_iso_code_key" ON "countries"("iso_code");

CREATE TABLE IF NOT EXISTS "country_translations" (
    "id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "country_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "country_translations_country_id_locale_key" ON "country_translations"("country_id", "locale");
CREATE INDEX IF NOT EXISTS "country_translations_locale_idx" ON "country_translations"("locale");

CREATE TABLE IF NOT EXISTS "cities" (
    "id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ascii_name" TEXT NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cities_country_id_name_idx" ON "cities"("country_id", "name");
CREATE INDEX IF NOT EXISTS "cities_ascii_name_idx" ON "cities"("ascii_name");

CREATE TABLE IF NOT EXISTS "districts" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "districts_city_id_name_idx" ON "districts"("city_id", "name");

DO $$ BEGIN
  ALTER TABLE "country_translations" ADD CONSTRAINT "country_translations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "districts" ADD CONSTRAINT "districts_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Organization: yapilandirilmis lokasyon (mevcut serbest-metin country/city korunuyor)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "location_country_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "location_city_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "location_district_id" TEXT;

CREATE INDEX IF NOT EXISTS "organizations_location_country_id_idx" ON "organizations"("location_country_id");
CREATE INDEX IF NOT EXISTS "organizations_location_city_id_idx" ON "organizations"("location_city_id");

DO $$ BEGIN
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_location_country_id_fkey" FOREIGN KEY ("location_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_location_city_id_fkey" FOREIGN KEY ("location_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_location_district_id_fkey" FOREIGN KEY ("location_district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- GymMember: yapilandirilmis uyruk (mevcut serbest-metin nationality korunuyor)
ALTER TABLE "gym_members" ADD COLUMN IF NOT EXISTS "nationality_country_id" TEXT;

CREATE INDEX IF NOT EXISTS "gym_members_nationality_country_id_idx" ON "gym_members"("nationality_country_id");

DO $$ BEGIN
  ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_nationality_country_id_fkey" FOREIGN KEY ("nationality_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
