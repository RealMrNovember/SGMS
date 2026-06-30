import { auth } from '@/lib/auth';
import { buildDashboardLicenseSummary } from '@/lib/dashboard-license';
import { licenseStatusKey, resolveLicenseCardHint } from '@/lib/license-i18n';
import { refreshDashboardLicense } from '@/lib/license-dashboard';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;

  const t = await getTranslations('dashboard');
  const tNav = await getTranslations('nav');
  const tLicense = await getTranslations('license');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

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

  const hint = resolveLicenseCardHint(role, license);
  const licenseHint = tLicense(hint.key, hint.values);

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">{t('welcome', { name: session.user.name ?? '' })}</h2>
        <p className="muted mt-2 text-sm leading-6">
          {license.isOperational
            ? t('subtitleOperational', {
                role: role ?? tNav('team'),
                orgName: organization.name,
              })
            : t('subtitleReadOnly', {
                role: role ?? tNav('team'),
                orgName: organization.name,
              })}
          {license.isOperational ? (
            <>
              {' '}
              <Link href="/dashboard/members" className="text-sky-300 hover:underline">
                {tNav('members')}
              </Link>
              {' · '}
              <Link href="/dashboard/programs" className="text-sky-300 hover:underline">
                {tNav('programs')}
              </Link>
            </>
          ) : null}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card p-5">
          <p className="muted text-sm">{t('cards.organization')}</p>
          <p className="mt-2 text-lg font-semibold">{organization.name}</p>
          <p className="muted mt-1 text-xs">{organization.slug}</p>
          <p className="muted mt-2 text-xs">
            {t('cards.activeMembersDevices', {
              members: organization._count.gymMembers,
              devices: organization._count.devices,
            })}
          </p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">{t('cards.saasPlan')}</p>
          <p className="mt-2 text-lg font-semibold">
            {subscription?.plan.name ?? tCommon('noPlan')}
          </p>
          <p className="muted mt-1 text-xs">
            {subscription?.plan.currency ?? '—'} · {subscription?.status ?? '—'}
          </p>
          <p className="muted mt-2 text-xs">
            {t('limits.planLimit', {
              members: subscription?.plan.maxMembers ?? '—',
              staff: subscription?.plan.maxStaff ?? '—',
            })}
          </p>
        </article>

        <article
          className={`card p-5 ${license.isOperational ? '' : 'border-rose-500/40 bg-rose-500/5'}`}
        >
          <p className="muted text-sm">{t('cards.centralLicense')}</p>
          <p className="mt-2 text-lg font-semibold">
            {tLicense(licenseStatusKey(license.status))}
          </p>
          <p className="muted mt-1 text-xs">
            {license.type ?? '—'}
            {license.expiresAt
              ? ` · ${t('cards.expiresAt', {
                  date: license.expiresAt.toLocaleDateString(dateLocale),
                })}`
              : ''}
          </p>
          <p className="muted mt-2 text-xs">
            {license.daysRemaining != null
              ? t('cards.daysRemaining', { days: license.daysRemaining })
              : t('cards.noExpiryInfo')}
            {license.lastCheckAt
              ? ` · ${t('cards.lastCheck', {
                  date: license.lastCheckAt.toLocaleString(dateLocale),
                })}`
              : ''}
          </p>
        </article>

        <article className="card p-5">
          <p className="muted text-sm">{t('cards.installation')}</p>
          <p className="mt-2 font-mono text-sm">{organization.installationId.slice(0, 13)}…</p>
          <p className="muted mt-2 text-xs leading-5">{licenseHint}</p>
          {license.status === 'TRIAL' && license.trialStartedAt ? (
            <p className="muted mt-1 text-xs">
              {t('cards.trialStarted', {
                date: license.trialStartedAt.toLocaleDateString(dateLocale),
              })}
            </p>
          ) : null}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <h3 className="font-semibold">{t('limits.title')}</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            <li>{t('limits.maxMembers', { count: subscription?.plan.maxMembers ?? '—' })}</li>
            <li>{t('limits.maxDevices', { count: subscription?.plan.maxDevices ?? '—' })}</li>
            <li>{t('limits.maxStaff', { count: subscription?.plan.maxStaff ?? '—' })}</li>
          </ul>
        </article>

        <article className="card p-5">
          <h3 className="font-semibold">{t('teamSummary.title')}</h3>
          <ul className="muted mt-3 space-y-2 text-sm">
            {organization.members.length === 0 ? (
              <li>{t('teamSummary.empty')}</li>
            ) : (
              organization.members.map((member) => (
                <li key={member.id}>
                  {member.user.name} · {member.role}
                </li>
              ))
            )}
          </ul>
          <Link href="/dashboard/team" className="muted mt-4 inline-block text-xs hover:text-white">
            {t('teamSummary.manageLink')}
          </Link>
        </article>
      </section>
    </div>
  );
}
