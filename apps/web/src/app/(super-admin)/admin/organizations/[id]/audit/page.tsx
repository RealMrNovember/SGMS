import { AdminAuditLogSection } from '@/components/admin/admin-audit-log-section';
import { auth } from '@/lib/auth';
import type { AuditPageParams } from '@/lib/admin/audit-path';
import type { AuditLogFilters } from '@/lib/admin/queries';
import { prisma } from '@/lib/prisma';
import type { AuditCategory } from '@/lib/admin/audit-labels';
import type { AuditAction } from '@sgms/database';
import { notFound, redirect } from 'next/navigation';

export default async function AdminOrganizationAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AuditPageParams>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const pageParams = await searchParams;

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) {
    notFound();
  }

  const filters: AuditLogFilters = {
    q: pageParams.q,
    category:
      pageParams.category && pageParams.category !== 'all'
        ? (pageParams.category as AuditCategory)
        : undefined,
    action: pageParams.action as AuditAction | undefined,
    organizationId: organization.id,
    from: pageParams.from,
    to: pageParams.to,
    hideNoise: pageParams.showNoise !== '1',
  };

  return (
    <div className="mx-auto max-w-[90rem]">
      <AdminAuditLogSection
        basePath={`/admin/organizations/${organization.id}/audit`}
        pageParams={pageParams}
        filters={filters}
        organization={organization}
        showOrganizationColumn={false}
        showPlatformStats={false}
      />
    </div>
  );
}
