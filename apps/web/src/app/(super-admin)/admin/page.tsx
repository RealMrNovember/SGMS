import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const params = await searchParams;

  const [organizationCount, activeCount, userCount, planCount, organizations] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.plan.count({ where: { isActive: true, currency: 'TRY' } }),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        subscriptions: {
          where: { status: { in: ['TRIALING', 'ACTIVE'] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        members: {
          where: { role: 'OWNER', isActive: true },
          include: { user: true },
          take: 1,
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {params.created ? (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Yeni organizasyon oluşturuldu: <strong>{params.created}</strong>
        </section>
      ) : null}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Sistem Özeti</h2>
          <p className="muted mt-2 max-w-2xl text-sm leading-6">
            Platform genelindeki GYM kiracıları, aktif abonelikler ve kullanıcı dağılımına
            kuşbakışı bakış.
          </p>
        </div>
        <Link href="/admin/organizations/new" className="button button-gold px-5 py-3 text-sm">
          Yeni Müşteri Ekle
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Organizasyonlar</p>
          <p className="mt-3 text-3xl font-semibold">{organizationCount}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Aktif GYM</p>
          <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Tenant Kullanıcıları</p>
          <p className="mt-3 text-3xl font-semibold">{userCount}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">Aktif Planlar (TRY)</p>
          <p className="mt-3 text-3xl font-semibold">{planCount}</p>
        </article>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Organizasyonlar (GYM&apos;ler)</h3>
            <p className="muted mt-1 text-sm">Son eklenen kiracılar</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">Salon</th>
                <th className="px-6 py-3 font-medium">Sahip</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Durum</th>
                <th className="px-6 py-3 font-medium">Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => {
                const subscription = org.subscriptions[0] ?? null;
                const owner = org.members[0]?.user ?? null;

                return (
                  <tr key={org.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">
                      <p className="font-medium">{org.name}</p>
                      <p className="muted text-xs">{org.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p>{owner?.name ?? '—'}</p>
                      <p className="muted text-xs">{owner?.email ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">{subscription?.plan.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="badge">{org.status}</span>
                    </td>
                    <td className="muted px-6 py-4">
                      {org.createdAt.toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
