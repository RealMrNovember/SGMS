-- Faz 12.4: Master Admin kalıcı silme (hard-delete) audit action

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORGANIZATION_DELETED';
