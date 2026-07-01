import { auth } from '@/lib/auth';
import {
  auditActionLabel,
  auditCategoryForAction,
  auditSummary,
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
} from '@/lib/admin/audit-labels';
import {
  auditLogsToCsv,
  listAuditLogsForExport,
  type AuditLogFilters,
} from '@/lib/admin/queries';
import type { AuditAction } from '@sgms/database';

function parseFilters(searchParams: URLSearchParams): AuditLogFilters {
  const category = searchParams.get('category');
  const action = searchParams.get('action');

  return {
    q: searchParams.get('q') ?? undefined,
    category:
      category && category !== 'all' ? (category as AuditCategory) : undefined,
    action: action ? (action as AuditAction) : undefined,
    organizationId: searchParams.get('organizationId') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  };
}

function exportFilename(format: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `sgms-denetim-${stamp}.${format}`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv';
  const filters = parseFilters(searchParams);
  const logs = await listAuditLogsForExport(filters);

  if (format === 'json') {
    const payload = logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      action: log.action,
      actionLabel: auditActionLabel(log.action),
      category: auditCategoryForAction(log.action),
      categoryLabel: AUDIT_CATEGORY_LABELS[auditCategoryForAction(log.action)],
      organization: log.organization,
      actor: log.actor,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      summary: auditSummary(log.metadata, log.action),
      metadata: log.metadata,
    }));

    return Response.json(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="${exportFilename('json')}"`,
      },
    });
  }

  const csv = auditLogsToCsv(logs);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename('csv')}"`,
    },
  });
}
