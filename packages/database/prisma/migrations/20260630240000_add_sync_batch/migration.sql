-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN "client_event_id" TEXT;

-- CreateEnum
CREATE TYPE "SyncBatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "sync_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "event_count" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncBatchStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB NOT NULL DEFAULT '[]',
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_device_id_client_event_id_key" ON "check_ins"("device_id", "client_event_id");

-- CreateIndex
CREATE INDEX "sync_batches_organization_id_created_at_idx" ON "sync_batches"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_batches_device_id_created_at_idx" ON "sync_batches"("device_id", "created_at");

-- AddForeignKey
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
