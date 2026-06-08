-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('WORKOUT', 'NUTRITION');

-- AlterTable
ALTER TABLE "gym_members" ADD COLUMN     "trainer_id" TEXT,
ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "health_measurements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "weight" DECIMAL(5,2),
    "body_fat_percentage" DECIMAL(5,2),
    "muscle_mass" DECIMAL(5,2),
    "height" DECIMAL(5,2),
    "notes" TEXT,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ProgramType" NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_measurements_organization_id_gym_member_id_measured__idx" ON "health_measurements"("organization_id", "gym_member_id", "measured_at");

-- CreateIndex
CREATE INDEX "health_measurements_gym_member_id_measured_at_idx" ON "health_measurements"("gym_member_id", "measured_at");

-- CreateIndex
CREATE INDEX "training_programs_organization_id_gym_member_id_is_active_idx" ON "training_programs"("organization_id", "gym_member_id", "is_active");

-- CreateIndex
CREATE INDEX "training_programs_organization_id_trainer_id_is_active_idx" ON "training_programs"("organization_id", "trainer_id", "is_active");

-- CreateIndex
CREATE INDEX "training_programs_gym_member_id_type_is_active_idx" ON "training_programs"("gym_member_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "training_programs_trainer_id_start_date_idx" ON "training_programs"("trainer_id", "start_date");

-- CreateIndex
CREATE INDEX "direct_messages_organization_id_receiver_id_is_read_created_idx" ON "direct_messages"("organization_id", "receiver_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "direct_messages_organization_id_sender_id_created_at_idx" ON "direct_messages"("organization_id", "sender_id", "created_at");

-- CreateIndex
CREATE INDEX "direct_messages_organization_id_sender_id_receiver_id_creat_idx" ON "direct_messages"("organization_id", "sender_id", "receiver_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "gym_members_user_id_key" ON "gym_members"("user_id");

-- CreateIndex
CREATE INDEX "gym_members_organization_id_trainer_id_idx" ON "gym_members"("organization_id", "trainer_id");

-- CreateIndex
CREATE INDEX "gym_members_trainer_id_idx" ON "gym_members"("trainer_id");

-- CreateIndex
CREATE INDEX "gym_members_user_id_idx" ON "gym_members"("user_id");

-- AddForeignKey
ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_members" ADD CONSTRAINT "gym_members_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_measurements" ADD CONSTRAINT "health_measurements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_measurements" ADD CONSTRAINT "health_measurements_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
