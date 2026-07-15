-- Faz 30: Kurumsal hiyerarşi (çoklu şube/bölge konsolide raporlama)
-- Additive only: mevcut OrganizationRole yetki sistemine dokunmaz.

-- 1) AuditAction enum genişletmesi
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_HIERARCHY_LINKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_HIERARCHY_UNLINKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HIERARCHY_MEMBER_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HIERARCHY_MEMBER_REVOKED';

-- 2) Yeni HierarchyRole enum
CREATE TYPE "HierarchyRole" AS ENUM ('COMPANY_ADMIN', 'REGIONAL_MANAGER');

-- 3) Organization self-relation (parent/child ağaç)
ALTER TABLE "organizations" ADD COLUMN "parent_organization_id" TEXT;

CREATE INDEX "organizations_parent_organization_id_idx" ON "organizations"("parent_organization_id");

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_parent_organization_id_fkey"
  FOREIGN KEY ("parent_organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) HierarchyMember tablosu
CREATE TABLE "hierarchy_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "HierarchyRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hierarchy_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hierarchy_members_organization_id_user_id_key" ON "hierarchy_members"("organization_id", "user_id");
CREATE INDEX "hierarchy_members_user_id_is_active_idx" ON "hierarchy_members"("user_id", "is_active");

ALTER TABLE "hierarchy_members"
  ADD CONSTRAINT "hierarchy_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hierarchy_members"
  ADD CONSTRAINT "hierarchy_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
