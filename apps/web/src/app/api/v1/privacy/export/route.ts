import { requireTenantApiContext } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import {
  buildGymMembersCsv,
  buildOrganizationExport,
} from '@/lib/privacy/org-export';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireTenantApiContext(request, {
    roles: ['OWNER', 'ADMIN'],
  });
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const format = new URL(request.url).searchParams.get('format')?.toLowerCase();

  const data = await buildOrganizationExport(context.organizationId);
  if (!data) {
    return apiErrorI18n('notFound', 404, request);
  }

  await prisma.auditLog.create({
    data: {
      actorId: context.userId,
      organizationId: context.organizationId,
      action: 'DATA_EXPORT_REQUESTED',
      entityType: 'organization',
      entityId: context.organizationId,
      metadata: {
        memberCount: data.gymMembers.length,
        via: 'api',
        format: format === 'csv' ? 'csv' : 'json',
      },
    },
  });

  const safeName = data.organizationName.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const datePart = data.exportedAt.slice(0, 10);

  if (format === 'csv') {
    const csv = buildGymMembersCsv(data);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="members_${safeName}_${datePart}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="export_${safeName}_${datePart}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
