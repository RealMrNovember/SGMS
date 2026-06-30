-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'RFID', 'MANUAL', 'DEVICE');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_CHECK_IN';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN "api_key_hash" TEXT;

-- AlterTable
ALTER TABLE "gym_members" ADD COLUMN "rfid_tag" TEXT;

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "device_id" TEXT,
    "method" "CheckInMethod" NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_api_key_hash_key" ON "devices"("api_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "gym_members_organization_id_rfid_tag_key" ON "gym_members"("organization_id", "rfid_tag");

-- CreateIndex
CREATE INDEX "check_ins_organization_id_checked_in_at_idx" ON "check_ins"("organization_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "check_ins_gym_member_id_checked_in_at_idx" ON "check_ins"("gym_member_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "check_ins_device_id_checked_in_at_idx" ON "check_ins"("device_id", "checked_in_at");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
