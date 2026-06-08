import { auth } from '@/lib/auth';
import {
  buildDashboardLicenseSummary,
  licenseCardHint,
} from '@/lib/dashboard-license';
import { refreshDashboardLicense } from '@/lib/license-dashboard';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;

  await refreshDashboardLicense(organizationId);

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscriptions: {
        where: { status: { in: ['TRIALING', 'ACTIVE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      members: {
        where: { isActive: true },
        include: { user: true },
        take: 8,
      },
      _count: {
        select: {
          gymMembers: { where: { status: { not: 'INACTIVE' } } },
          devices: { where: { status: { not: 'DISABLED' } } },
        },
      },
    },
  });

  if (!organization) {
    redirect('/login');
  }

  const subscription = organization.subscriptions[0] ?? null;
  const license = buildDashboardLicenseSummary({
    centralLicenseStatus: organization.centralLicenseStatus,
    centralLicenseType: organization.centralLicenseType,
    licenseExpiresAt: organization.licenseExpiresAt,
    lastLicenseCheckAt: organization.lastLicenseCheckAt,
    trialStartedAt: organization.trialStartedAt,
    installationId: organization.installationId,
  });

  const licenseHint = licenseCardHint(role, license);

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">Hoş geldiniz, {session.user.name}</h2>
        <p className="muted mt-2 text-sm leading-6">
          {role ?? 'Personel'} · {organization.name} yönetim paneli.
          {license.isOperational ? (
            <>
              {' '}
              <Link href="/dashboard/members" className="text-sky-300 hover:underline">
                Üyeler
              </Link>
              {' · '}
              <Link href="/dashboard/programs" className="text-sky-300 hover:underline">
                Programlar
              </Link>
            </>
          ) : (
            ' Merkezi lisans geçersiz — salt okunur mod.'
          )}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card p-5">
          <p className="muted text-sm">Organizasyon</p>
          <p className="mt-2 text-lg font-semibold">{organization.name}</p>
          <p className="muted mt-1 text-xs">{organization.slug}</p>
          <p className="muted mt-2 text-xs">
            {organization._count.gymMembers} aktif üye · {organization._count.devices} cihaz
          </p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">SaaS Planı</p>
          <p className="mt-2 text-lg font-semibold">{subscription?.plan.name ?? 'Plan yok'}</p>
          <p className="muted mt-1 text-xs">
            {subscription?.plan.currency ?? '—'} · {subscription?.status ?? '—'}
          </p>
          <p className="muted mt-2 text-xs">
            Limit: {subscription?.plan.maxMembers ?? '—'} üye / {subscription?.plan.maxStaff ?? '—'}{' '}
            personel
          </p>
        </article>

        <article
          className={`card p-5 ${license.isOperational ? '' : 'border-rose-500/40 bg-rose-500/5'}`}
        >
          <p className="muted text-sm">Merkezi Lisans</p>
          <p className="mt-2 text-lg font-semibold">{license.statusLabel}</p>
          <p className="muted mt-1 text-xs">
            {license.type ?? '—'}
            {license.expiresAt
              ? ` · bitiş ${license.expiresAt.toLocaleDateString('tr-TR')}`
              : ''}
          </p>
          <p className="muted mt-2 text-xs">
            {license.daysRemaining != null
              ? `${license.daysRemaining} gün kaldı`
              : 'Süre bilgisi yok'}
            {license.lastCheckAt
              ? ` · son kontrol ${license.lastCheckAt.toLocaleString('tr-TR')}`
              : ''}
          </p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">Kurulum (HWID)</p>
          <p className="mt-2 font-mono text-sm">{organization.installationId.slice(0, 13)}…</p>
          <p className="muted mt-2 text-xs leading-5">{licenseHint}</p>
          {license.status === 'TRIAL' && license.trialStartedAt ? (
            <p className="muted mt-1 text-xs">
              Deneme başlangıcı: {license.trialStartedAt.toLocaleDateString('tr-TR')}
            </p>
          ) : null}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold">Salon limitleri</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            <li>Maks. üye: {subscription?.plan.maxMembers ?? '—'}</li>
            <li>Maks. cihaz: {subscription?.plan.maxDevices ?? '—'}</li>
            <li>Maks. personel: {subscription?.plan.maxStaff ?? '—'}</li>
          </ul>
        </article>

        <article className="card p-5">
          <h3 className="font-semibold">Ekip özeti</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            {organization.members.length === 0 ? (
              <li>Henüz personel kaydı yok.</li>
            ) : (
              organization.members.map((member) => (
                <li key={member.id}>
                  {member.user.name} · {member.role}
                </li>
              ))
            )}
          </ul>
          <Link href="/dashboard/team" className="muted mt-4 inline-block text-xs hover:text-white">
            Personel yönetimi →
          </Link>
        </article>
      </section>
    </div>
  );
}
