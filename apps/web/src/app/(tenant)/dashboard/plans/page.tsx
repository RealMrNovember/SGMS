import { AddPlanForm } from '@/components/add-plan-form';
import { EditPlanForm } from '@/components/edit-plan-form';
import { TogglePlanButton } from '@/components/toggle-plan-button';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
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
          ← Özet
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">Salon Üyelik Planları</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          Sporculara atanan yerel paketler (SaaS abonelik planından bağımsız).
        </p>
      </div>

      <AddPlanForm canManage={canManage} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Plan Listesi</h3>
          <p className="muted mt-1 text-sm">{plans.length} plan</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {plans.length === 0 ? (
            <p className="muted px-6 py-8 text-center text-sm">Henüz plan tanımlanmamış.</p>
          ) : (
            plans.map((plan) => (
              <article key={plan.id} className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {plan.name}
                      <span className={`badge ml-2 ${plan.isActive ? '' : 'opacity-50'}`}>
                        {plan.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </p>
                    <p className="muted mt-1 text-sm">
                      {plan.durationDays} gün · {plan.price.toString()} {plan.currency}
                      {plan.description ? ` · ${plan.description}` : ''}
                    </p>
                    <p className="muted text-xs">{plan._count.gymMembers} üye bu plana bağlı</p>
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
