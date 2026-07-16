-- Faz 34.6: sporcunun kendi antrenman ilerlemesi (set tamamlama + kullanılan ağırlık)
-- Additive only: PT'nin program içerik editörüne (TrainingProgram.content) dokunmaz.

CREATE TABLE "exercise_set_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "training_program_id" TEXT NOT NULL,
    "gym_member_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "exercise_index" INTEGER NOT NULL,
    "performed_date" DATE NOT NULL,
    "completed_sets" INTEGER NOT NULL DEFAULT 0,
    "total_sets" INTEGER NOT NULL,
    "weight_used" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_set_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exercise_set_logs_training_program_id_gym_member_id_day_i_key"
  ON "exercise_set_logs"("training_program_id", "gym_member_id", "day_index", "exercise_index", "performed_date");

CREATE INDEX "exercise_set_logs_organization_id_gym_member_id_performed__idx"
  ON "exercise_set_logs"("organization_id", "gym_member_id", "performed_date");

ALTER TABLE "exercise_set_logs"
  ADD CONSTRAINT "exercise_set_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exercise_set_logs"
  ADD CONSTRAINT "exercise_set_logs_training_program_id_fkey"
  FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exercise_set_logs"
  ADD CONSTRAINT "exercise_set_logs_gym_member_id_fkey"
  FOREIGN KEY ("gym_member_id") REFERENCES "gym_members"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
