-- cloud.cicibyte.com tenant senkron audit aksiyonları (license.cicibyte.com göçü)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLOUD_TENANT_SYNCED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLOUD_SYNC_FAILED';
