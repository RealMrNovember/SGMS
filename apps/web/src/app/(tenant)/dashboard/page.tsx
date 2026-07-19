import { auth } from '@/lib/auth';
import { buildDashboardLicenseSummary } from '@/lib/dashboard-license';
import { getDashboardKpis } from '@/lib/dashboard-kpis';
import { licenseStatusKey, resolveLicenseCardHint } from '@/lib/license-i18n';
import { refreshDashboardLicense } from '@/lib/license-dashboard';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { ReceptionDownloadPromo } from '@/components/reception/reception-download-promo';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const RECEPTION_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const TEAM_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

const COMING_SOON_TEASER_FEATURES = ['digitalCard', 'insights', 'integrations', 'notifications'] as const;
const COMING_SOON_ICONS: Record<(typeof COMING_SOON_TEASER_FEATURES)[number], string> = {
  digitalCard: '📱',
  insights: '🤖',
  integrations: '🔌',
  notifications: '🔔',
};

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
  const tComingSoon = await getTranslations('comingSoon');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  await refreshDashboardLicense(organizationId);

  const kpis = await getDashboardKpis(organizationId);

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
  const effectiveMaxMembers = subscription
    ? subscription.plan.maxMembers + organization.extraMemberCapacity
    : null;
  const effectiveMaxStaff = subscription
    ? subscription.plan.maxStaff + organization.extraStaffCapacity
    : null;
  const effectiveMaxDevices = subscription
    ? subscription.plan.maxDevices + organization.extraDeviceCapacity
    : null;
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

      {license.isOperational && kpis.membershipsExpiringSoonCount > 0 ? (
        <section className="card flex flex-col gap-3 border-amber-500/40 bg-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-amber-100">
              {t('alerts.expiringTitle', { count: kpis.membershipsExpiringSoonCount })}
            </p>
            <p className="muted mt-1 text-sm">{t('alerts.expiringSubtitle')}</p>
          </div>
          <Link href="/dashboard/members" className="button shrink-0 px-4 py-2 text-sm whitespace-nowrap">
            {t('alerts.expiringCta')} →
          </Link>
        </section>
      ) : null}

      {license.isOperational && kpis.overdueInstallmentCount > 0 ? (
        <section className="card flex flex-col gap-3 border-rose-500/40 bg-rose-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-rose-100">
              {t('alerts.overdueTitle', { count: kpis.overdueInstallmentCount })}
            </p>
            <p className="muted mt-1 text-sm">{t('alerts.overdueSubtitle')}</p>
          </div>
          <Link href="/dashboard/payment-plans" className="button shrink-0 px-4 py-2 text-sm whitespace-nowrap">
            {t('alerts.overdueCta')} →
          </Link>
        </section>
      ) : null}

      {role && RECEPTION_ROLES.has(role) && license.isOperational ? (
        <ReceptionDownloadPromo variant="card" />
      ) : null}

      {license.isOperational ? (
        <section className="card p-5">
          <h3 className="font-semibold">{t('quickActions.title')}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Link
              href="/dashboard/members"
              className="button flex flex-col items-center gap-2 py-4 text-center text-xs sm:text-sm"
            >
              <span className="text-xl" aria-hidden="true">➕</span>
              {t('quickActions.newMember')}
            </Link>
            <Link
              href="/dashboard/check-in"
              className="button flex flex-col items-center gap-2 py-4 text-center text-xs sm:text-sm"
            >
              <span className="text-xl" aria-hidden="true">🚪</span>
              {t('quickActions.checkIn')}
            </Link>
            <Link
              href="/dashboard/pos"
              className="button flex flex-col items-center gap-2 py-4 text-center text-xs sm:text-sm"
            >
              <span className="text-xl" aria-hidden="true">💳</span>
              {t('quickActions.takePayment')}
            </Link>
            <Link
              href="/dashboard/messages"
              className="button flex flex-col items-center gap-2 py-4 text-center text-xs sm:text-sm"
            >
              <span className="text-xl" aria-hidden="true">💬</span>
              {t('quickActions.sendMessage')}
            </Link>
            {role && TEAM_MANAGER_ROLES.has(role) ? (
              <Link
                href="/dashboard/team"
                className="button flex flex-col items-center gap-2 py-4 text-center text-xs sm:text-sm"
              >
                <span className="text-xl" aria-hidden="true">🗂️</span>
                {t('quickActions.viewTeam')}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-5">
        <article className="card p-5">
          <p className="muted text-sm">{t('kpis.checkInsToday')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{kpis.checkInsToday}</p>
          <Link href="/dashboard/check-in" className="muted mt-2 inline-block text-xs hover:text-white">
            {t('kpis.checkInsLink')} →
          </Link>
        </article>
        <article className="card p-5">
          <p className="muted text-sm">{t('kpis.revenueThisMonth')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {new Intl.NumberFormat(dateLocale, {
              style: 'currency',
              currency: 'TRY',
              maximumFractionDigits: 0,
            }).format(kpis.revenueThisMonth)}
          </p>
          <Link href="/dashboard/pos" className="muted mt-2 inline-block text-xs hover:text-white">
            {t('kpis.revenueLink')} →
          </Link>
        </article>
        <article
          className={`card p-5 ${kpis.membershipsExpiringSoonCount > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
        >
          <p className="muted text-sm">{t('kpis.expiringSoon')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{kpis.membershipsExpiringSoonCount}</p>
          <Link href="/dashboard/members" className="muted mt-2 inline-block text-xs hover:text-white">
            {t('kpis.expiringSoonLink')} →
          </Link>
        </article>
        <article
          className={`card p-5 ${kpis.overdueInstallmentCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}`}
        >
          <p className="muted text-sm">{t('kpis.overdueInstallments')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{kpis.overdueInstallmentCount}</p>
          <Link href="/dashboard/payment-plans" className="muted mt-2 inline-block text-xs hover:text-white">
            {t('kpis.overdueInstallmentsLink')} →
          </Link>
        </article>
        <article
          className={`card p-5 ${kpis.lowStockCount > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
        >
          <p className="muted text-sm">{t('kpis.lowStock')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{kpis.lowStockCount}</p>
          <Link href="/dashboard/pos" className="muted mt-2 inline-block text-xs hover:text-white">
            {t('kpis.lowStockLink')} →
          </Link>
        </article>
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
              members: effectiveMaxMembers ?? '—',
              staff: effectiveMaxStaff ?? '—',
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
            <li>{t('limits.maxMembers', { count: effectiveMaxMembers ?? '—' })}</li>
            <li>{t('limits.maxDevices', { count: effectiveMaxDevices ?? '—' })}</li>
            <li>{t('limits.maxStaff', { count: effectiveMaxStaff ?? '—' })}</li>
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

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-semibold">{t('comingSoonTeaser.title')}</h3>
            <p className="muted mt-1 text-sm">{t('comingSoonTeaser.subtitle')}</p>
          </div>
          <Link href="/#roadmap" className="muted text-xs hover:text-white">
            {t('comingSoonTeaser.cta')} →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON_TEASER_FEATURES.map((feature) => (
            <Link
              key={feature}
              href={`/dashboard/coming-soon/${feature}`}
              className="rounded-xl border border-[var(--border)] p-4 text-sm transition hover:border-[#c9a962]/40 hover:bg-white/5"
            >
              <span className="text-xl" aria-hidden="true">
                {COMING_SOON_ICONS[feature]}
              </span>
              <p className="mt-2 font-medium">{tComingSoon(`features.${feature}.title`)}</p>
              <span className="badge mt-2 inline-block text-[10px]">{tComingSoon('badge')}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
