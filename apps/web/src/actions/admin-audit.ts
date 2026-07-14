'use server';

import { auditSummary } from '@/lib/admin/audit-labels';
import { buildAuditWhere, type AuditLogFilters } from '@/lib/admin/audit-query';
import { writeAdminAuditLog } from '@/lib/admin/audit-write';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type AdminAuditState = {
  error?: string;
  success?: string;
  deletedCount?: number;
};

function revalidateAuditPaths(organizationId?: string | null) {
  revalidatePath('/admin/audit');
  if (organizationId) {
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(`/admin/organizations/${organizationId}/audit`);
  }
}

async function logDeletion(input: {
  actorId: string;
  organizationId?: string | null;
  metadata: Record<string, unknown>;
}) {
  await writeAdminAuditLog({
    actorId: input.actorId,
    organizationId: input.organizationId ?? null,
    action: 'AUDIT_LOG_DELETED',
    entityType: 'audit_log',
    metadata: input.metadata,
  });
}

export async function deleteAuditLog(logId: string): Promise<AdminAuditState> {
  try {
    const session = await requireSuperAdmin();

    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        action: true,
        createdAt: true,
        organizationId: true,
        metadata: true,
        actorId: true,
      },
    });

    if (!log) {
      return { error: 'Log kaydı bulunamadı.' };
    }

    await prisma.auditLog.delete({ where: { id: logId } });

    await logDeletion({
      actorId: session.user.id,
      organizationId: log.organizationId,
      metadata: {
        mode: 'single',
        deletedLogId: log.id,
        deletedAction: log.action,
        deletedAt: log.createdAt.toISOString(),
        deletedSummary: auditSummary(log.metadata, log.action),
      },
    });

    revalidateAuditPaths(log.organizationId);
    return { success: 'Log kaydı silindi.', deletedCount: 1 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Silme işlemi başarısız.' };
  }
}

export async function deleteAuditLogs(logIds: string[]): Promise<AdminAuditState> {
  try {
    const session = await requireSuperAdmin();
    const uniqueIds = [...new Set(logIds.filter(Boolean))];

    if (!uniqueIds.length) {
      return { error: 'Silinecek kayıt seçilmedi.' };
    }

    const logs = await prisma.auditLog.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        action: true,
        createdAt: true,
        organizationId: true,
        metadata: true,
      },
    });

    if (!logs.length) {
      return { error: 'Seçili log kayıtları bulunamadı.' };
    }

    await prisma.auditLog.deleteMany({ where: { id: { in: logs.map((l) => l.id) } } });

    const orgIds = [...new Set(logs.map((l) => l.organizationId).filter(Boolean))] as string[];

    await logDeletion({
      actorId: session.user.id,
      organizationId: orgIds.length === 1 ? orgIds[0] : null,
      metadata: {
        mode: 'selection',
        deletedCount: logs.length,
        deletedLogIds: logs.map((l) => l.id),
        deletedActions: [...new Set(logs.map((l) => l.action))],
        organizationIds: orgIds,
      },
    });

    revalidateAuditPaths(orgIds[0]);
    revalidatePath('/admin/audit');
    for (const orgId of orgIds) {
      revalidateAuditPaths(orgId);
    }

    return { success: `${logs.length} log kaydı silindi.`, deletedCount: logs.length };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Toplu silme başarısız.' };
  }
}

export async function deleteAuditLogsByFilter(
  filters: AuditLogFilters,
  expectedCount: number,
): Promise<AdminAuditState> {
  try {
    const session = await requireSuperAdmin();
    const where = buildAuditWhere(filters);
    const count = await prisma.auditLog.count({ where });

    if (count === 0) {
      return { error: 'Filtreye uygun silinecek kayıt yok.' };
    }

    if (count !== expectedCount) {
      return {
        error: `Kayıt sayısı değişti (${expectedCount} → ${count}). İşlemi yenileyip tekrar deneyin.`,
      };
    }

    const sample = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, action: true, createdAt: true },
    });

    await prisma.auditLog.deleteMany({ where });

    await logDeletion({
      actorId: session.user.id,
      organizationId: filters.organizationId ?? null,
      metadata: {
        mode: 'filter',
        deletedCount: count,
        filters,
        sampleDeleted: sample.map((row) => ({
          id: row.id,
          action: row.action,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    });

    revalidateAuditPaths(filters.organizationId);
    return { success: `${count} log kaydı silindi.`, deletedCount: count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Filtreli silme başarısız.' };
  }
}
