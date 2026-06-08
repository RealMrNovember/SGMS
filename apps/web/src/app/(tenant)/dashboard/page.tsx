import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      subscriptions: {
        where: { status: { in: ['TRIALING', 'ACTIVE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      devices: true,
      members: {
        where: { isActive: true },
        include: { user: true },
      },
    },
  });

  const subscription = organization?.subscriptions[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">Hoş geldiniz</h2>
        <p className="muted mt-2 text-sm leading-6">
          Tenant yönetim paneliniz aktif. Personel eklemek için{' '}
          <Link href="/dashboard/team" className="text-sky-300 hover:underline">
            Personel
          </Link>{' '}
          sayfasını kullanın.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card p-5">
          <p className="muted text-sm">Organizasyon</p>
          <p className="mt-2 text-lg font-semibold">{organization?.name}</p>
          <p className="muted mt-1 text-xs">{organization?.slug}</p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">Plan</p>
          <p className="mt-2 text-lg font-semibold">{subscription?.plan.name ?? 'Plan yok'}</p>
          <p className="muted mt-1 text-xs">
            {subscription?.plan.currency ?? '—'} · {subscription?.status ?? '—'}
          </p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">Merkezi lisans</p>
          <p className="mt-2 text-lg font-semibold">{organization?.centralLicenseStatus}</p>
          <p className="muted mt-1 text-xs">
            Kurulum ID: {organization?.installationId.slice(0, 8)}…
          </p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold">Yerel limitler (Plan)</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            <li>Maks. üye: {subscription?.plan.maxMembers ?? '—'}</li>
            <li>Maks. cihaz: {subscription?.plan.maxDevices ?? '—'}</li>
            <li>Maks. personel: {subscription?.plan.maxStaff ?? '—'}</li>
          </ul>
        </article>

        <article className="card p-5">
          <h3 className="font-semibold">Ekip</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            {organization?.members.map((member) => (
              <li key={member.id}>
                {member.user.name} · {member.role}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
