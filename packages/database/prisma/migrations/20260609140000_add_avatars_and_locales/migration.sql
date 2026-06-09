-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

-- AlterTable
ALTER TABLE "gym_members" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'tr';
ALTER TABLE "gym_members" ADD COLUMN "avatar_url" TEXT;
