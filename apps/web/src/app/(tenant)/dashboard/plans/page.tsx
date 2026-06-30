import { AddPlanForm } from '@/components/add-plan-form';
import { EditPlanForm } from '@/components/edit-plan-form';
import { TogglePlanButton } from '@/components/toggle-plan-button';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const PLAN_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export default async function PlansPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const canManage = role ? PLAN_MANAGER_ROLES.has(role) : false;

  const t = await getTranslations('plans');
  const tCommon = await getTranslations('common');

  const plans = await prisma.gymMembershipPlan.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { gymMembers: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{t('subtitle')}</p>
      </div>

      <AddPlanForm canManage={canManage} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('listCount', { count: plans.length })}</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {plans.length === 0 ? (
            <p className="muted px-6 py-8 text-center text-sm">{t('empty')}</p>
          ) : (
            plans.map((plan) => (
              <article key={plan.id} className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {plan.name}
                      <span className={`badge ml-2 ${plan.isActive ? '' : 'opacity-50'}`}>
                        {plan.isActive ? tCommon('active') : tCommon('inactive')}
                      </span>
                    </p>
                    <p className="muted mt-1 text-sm">
                      {t('planMeta', {
                        days: plan.durationDays,
                        price: plan.price.toString(),
                        currency: plan.currency,
                      })}
                      {plan.description ? ` · ${plan.description}` : ''}
                    </p>
                    <p className="muted text-xs">
                      {tCommon('membersLinked', { count: plan._count.gymMembers })}
                    </p>
                  </div>
                  {canManage ? (
                    <TogglePlanButton planId={plan.id} isActive={plan.isActive} />
                  ) : null}
                </div>

                {canManage ? (
                  <EditPlanForm
                    plan={{
                      id: plan.id,
                      name: plan.name,
                      description: plan.description,
                      durationDays: plan.durationDays,
                      price: plan.price.toString(),
                      currency: plan.currency,
                      sortOrder: plan.sortOrder,
                    }}
                  />
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
