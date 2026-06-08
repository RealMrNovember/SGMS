import { CreateOrganizationForm } from '@/components/create-organization-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function NewOrganizationPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const plans = await prisma.plan.findMany({
    where: { isActive: true, currency: 'TRY' },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      priceMonthly: true,
    },
  });

  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    code: plan.code,
    priceMonthly: plan.priceMonthly.toString(),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin" className="muted text-sm hover:text-white">
          ← Sistem Özeti
        </Link>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Yeni Müşteri (GYM)</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          Tek adımda organizasyon, plan aboneliği ve OWNER kullanıcısı oluşturulur.
        </p>
      </div>

      <CreateOrganizationForm plans={planOptions} />
    </div>
  );
}
