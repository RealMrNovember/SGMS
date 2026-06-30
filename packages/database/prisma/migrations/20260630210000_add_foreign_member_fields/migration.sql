-- AlterTable
ALTER TABLE "gym_members" ADD COLUMN "is_foreign_member" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gym_members" ADD COLUMN "nationality" TEXT;
ALTER TABLE "gym_members" ADD COLUMN "passport_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gym_members_organization_id_passport_number_key" ON "gym_members"("organization_id", "passport_number");
