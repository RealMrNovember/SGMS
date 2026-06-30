-- CreateEnum
CREATE TYPE "AccessDirection" AS ENUM ('ENTRY', 'EXIT');
CREATE TYPE "AccessSubjectType" AS ENUM ('GYM_MEMBER', 'STAFF');

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN "rfid_tag" TEXT;

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN "subject_type" "AccessSubjectType" NOT NULL DEFAULT 'GYM_MEMBER';
ALTER TABLE "check_ins" ADD COLUMN "direction" "AccessDirection" NOT NULL DEFAULT 'ENTRY';
ALTER TABLE "check_ins" ADD COLUMN "staff_user_id" TEXT;
ALTER TABLE "check_ins" ALTER COLUMN "gym_member_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_rfid_tag_key" ON "organization_members"("organization_id", "rfid_tag");
CREATE INDEX "check_ins_organization_id_direction_checked_in_at_idx" ON "check_ins"("organization_id", "direction", "checked_in_at");
CREATE INDEX "check_ins_staff_user_id_checked_in_at_idx" ON "check_ins"("staff_user_id", "checked_in_at");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
