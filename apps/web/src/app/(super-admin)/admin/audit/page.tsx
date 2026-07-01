import { AdminAuditLogSection } from '@/components/admin/admin-audit-log-section';
import { auth } from '@/lib/auth';
import type { AuditPageParams } from '@/lib/admin/audit-path';
import type { AuditLogFilters } from '@/lib/admin/queries';
import type { AuditCategory } from '@/lib/admin/audit-labels';
import type { AuditAction } from '@sgms/database';
import { redirect } from 'next/navigation';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditPageParams>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const params = await searchParams;

  const filters: AuditLogFilters = {
    q: params.q,
    category:
      params.category && params.category !== 'all'
        ? (params.category as AuditCategory)
        : undefined,
    action: params.action as AuditAction | undefined,
    organizationId: params.organizationId,
    from: params.from,
    to: params.to,
    hideNoise: params.showNoise !== '1',
  };

  return (
    <div className="mx-auto max-w-[90rem]">
      <AdminAuditLogSection
        basePath="/admin/audit"
        pageParams={params}
        filters={filters}
      />
    </div>
  );
}
