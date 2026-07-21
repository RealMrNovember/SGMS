-- Faz 39 — Hedef Takip (AthleteGoal) & Motivasyon Etkinlikleri (GymEvent/GymEventRsvp)

-- CreateEnum
CREATE TYPE "GoalCreatedByType" AS ENUM ('SELF', 'TRAINER');

-- CreateEnum
CREATE TYPE "GoalTargetType" AS ENUM ('WEIGHT_LOSS', 'WEIGHT_GAIN', 'BODY_FAT_REDUCTION', 'MEASUREMENT_CHANGE', 'WORKOUT_FREQUENCY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GoalDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GymEventType" AS ENUM ('WALK', 'RUN', 'SPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "GymEventRsvpStatus" AS ENUM ('GOING', 'CANCELLED');

-- CreateTable
CREATE TABLE "athlete_goals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "created_by_type" "GoalCreatedByType" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "target_type" "GoalTargetType" NOT NULL,
    "measurement_field" TEXT,
    "direction" "GoalDirection",
    "target_value" DECIMAL(8,2),
    "start_value" DECIMAL(8,2),
    "target_date" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "achieved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "GymEventType" NOT NULL DEFAULT 'OTHER',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_event_rsvps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gym_event_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "status" "GymEventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "athlete_goals_organization_id_gym_member_id_status_idx" ON "athlete_goals"("organization_id", "gym_member_id", "status");

-- CreateIndex
CREATE INDEX "athlete_goals_gym_member_id_status_idx" ON "athlete_goals"("gym_member_id", "status");

-- CreateIndex
CREATE INDEX "athlete_goals_organization_id_status_target_date_idx" ON "athlete_goals"("organization_id", "status", "target_date");

-- CreateIndex
CREATE INDEX "gym_events_organization_id_starts_at_idx" ON "gym_events"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "gym_event_rsvps_organization_id_gym_event_id_idx" ON "gym_event_rsvps"("organization_id", "gym_event_id");

-- CreateIndex
CREATE INDEX "gym_event_rsvps_gym_member_id_idx" ON "gym_event_rsvps"("gym_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "gym_event_rsvps_gym_event_id_gym_member_id_key" ON "gym_event_rsvps"("gym_event_id", "gym_member_id");

-- AddForeignKey
ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_events" ADD CONSTRAINT "gym_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_events" ADD CONSTRAINT "gym_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_event_rsvps" ADD CONSTRAINT "gym_event_rsvps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_event_rsvps" ADD CONSTRAINT "gym_event_rsvps_gym_event_id_fkey" FOREIGN KEY ("gym_event_id") REFERENCES "gym_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_event_rsvps" ADD CONSTRAINT "gym_event_rsvps_gym_member_id_fkey" FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
