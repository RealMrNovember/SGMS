import { DiscountCreateForm } from '@/components/discounts/discount-create-form';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DiscountsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz17.discounts');

  const codes = await prisma.discountCode.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <DiscountCreateForm />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {codes.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('empty')}</p>
          ) : (
            codes.map((code) => (
              <article key={code.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium">{code.code}</p>
                  <p className="muted text-sm">
                    {code.type === 'PERCENT' ? `%${code.value}` : `${code.value} TRY`} · {code.usedCount}
                    {code.maxUses != null ? `/${code.maxUses}` : ''} {t('uses')}
                  </p>
                </div>
                <span className="badge text-[10px]">{code.isActive ? t('active') : t('inactive')}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
