import { PlanEditForm } from '@/components/admin/plan-edit-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AdminPlansPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const tAdmin = await getTranslations('admin');

  const plans = await prisma.plan.findMany({
    where: { currency: 'TRY' },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('plansTitle')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{tAdmin('plansSubtitle')}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((plan) => (
          <PlanEditForm
            key={plan.id}
            plan={{
              id: plan.id,
              code: plan.code,
              name: plan.name,
              description: plan.description,
              currency: plan.currency,
              priceMonthly: plan.priceMonthly.toString(),
              priceYearly: plan.priceYearly.toString(),
              maxMembers: plan.maxMembers,
              maxStaff: plan.maxStaff,
              maxDevices: plan.maxDevices,
              isActive: plan.isActive,
              sortOrder: plan.sortOrder,
            }}
          />
        ))}
      </div>
    </div>
  );
}
