-- Faz 41 — Beslenme & Kalori Takibi (FoodLogEntry)

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "food_log_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "food_name" TEXT NOT NULL,
    "calories" INTEGER,
    "protein_g" DECIMAL(6,1),
    "carbs_g" DECIMAL(6,1),
    "fat_g" DECIMAL(6,1),
    "notes" TEXT,
    "photo_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_log_entries_organization_id_gym_member_id_logged_at_idx" ON "food_log_entries"("organization_id", "gym_member_id", "logged_at");

-- CreateIndex
CREATE INDEX "food_log_entries_gym_member_id_logged_at_idx" ON "food_log_entries"("gym_member_id", "logged_at");

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
