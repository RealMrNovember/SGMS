import { PartnerOrgManagementPanel } from '@/components/partner/partner-org-management-panel';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function PartnerOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.partnerId) {
    redirect('/login');
  }

  const t = await getTranslations('partner');

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
        take: 1,
      },
      members: {
        where: { role: 'OWNER', isActive: true },
        include: { user: { select: { name: true, email: true } } },
        take: 1,
      },
      _count: { select: { gymMembers: true, members: true, devices: true } },
    },
  });

  if (!organization || organization.partnerId !== session.user.partnerId) {
    notFound();
  }

  const subscription = organization.subscriptions[0] ?? null;
  const owner = organization.members[0]?.user ?? null;

  return (
    <div className="space-y-6">
      <Link href="/partner" className="muted text-sm hover:text-white">
        ← {t('nav.dashboard')}
      </Link>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">{organization.name}</h2>
        <p className="muted mt-1 text-sm">
          {t('detail.owner')}: {owner?.name ?? '—'}
          {owner?.email ? ` · ${owner.email}` : ''}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="muted text-xs">{t('detail.plan')}</p>
            <p className="mt-1 font-medium">{subscription?.plan.name ?? '—'}</p>
          </div>
          <div>
            <p className="muted text-xs">{t('detail.status')}</p>
            <p className="mt-1 font-medium">{subscription?.status ?? '—'}</p>
          </div>
          <div>
            <p className="muted text-xs">{t('detail.members')}</p>
            <p className="mt-1 font-medium">
              {organization._count.gymMembers} / {(subscription?.plan.maxMembers ?? 0) + organization.extraMemberCapacity}
            </p>
          </div>
        </div>
      </section>

      <PartnerOrgManagementPanel
        organizationId={organization.id}
        currentDiscountPercent={subscription?.partnerDiscountPercent ?? 0}
        currentDiscountNote={subscription?.partnerDiscountNote ?? ''}
        currentExtraMembers={organization.extraMemberCapacity}
        currentExtraStaff={organization.extraStaffCapacity}
        currentExtraDevices={organization.extraDeviceCapacity}
        trialEndsAt={subscription?.trialEndsAt?.toISOString() ?? null}
        currentPeriodEnd={subscription?.currentPeriodEnd?.toISOString() ?? null}
      />
    </div>
  );
}
