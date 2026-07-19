import { CheckInLiveRefresh } from '@/components/check-in-live-refresh';
import { DeviceManagementPanel } from '@/components/device-management-panel';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';
import { ManualCheckInForm } from '@/components/manual-check-in-form';
import { ReceptionDownloadPromo } from '@/components/reception/reception-download-promo';
import { MobileDownloadPromo } from '@/components/reception/mobile-download-promo';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

const CHECK_IN_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const DEVICE_ADMIN_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export default async function CheckInDashboardPage() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.role) {
    redirect('/login');
  }

  if (!CHECK_IN_ROLES.has(session.user.role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const canManageDevices = DEVICE_ADMIN_ROLES.has(session.user.role);
  const t = await getTranslations('checkIn');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayCount, recentCheckIns, devices, activeMembers] = await Promise.all([
    prisma.checkIn.count({
      where: { organizationId, checkedInAt: { gte: todayStart } },
    }),
    prisma.checkIn.findMany({
      where: { organizationId, checkedInAt: { gte: todayStart } },
      orderBy: { checkedInAt: 'desc' },
      take: 50,
      include: {
        gymMember: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        staffUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        device: { select: { name: true } },
      },
    }),
    prisma.device.findMany({
      where: { organizationId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
    prisma.gymMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 200,
    }),
  ]);

  const memberOptions = activeMembers.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
  }));

  return (
    <div className="space-y-8">
      <CheckInLiveRefresh organizationId={organizationId} />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <ContextualHelpButton topic="topic-checkin" />
          <span className="badge border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
            {t('live')}
          </span>
        </div>
        <p className="muted mt-2 text-sm">{t('subtitle')}</p>
      </div>

      <ReceptionDownloadPromo variant="card" />

      <MobileDownloadPromo variant="card" />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="muted text-xs">{t('stats.today')}</p>
          <p className="mt-2 text-3xl font-semibold">{todayCount}</p>
        </div>
        <div className="card p-5 sm:col-span-2">
          <p className="muted text-xs">{t('stats.scenario')}</p>
          <p className="mt-2 text-sm leading-7 text-white/90">{t('stats.scenarioText')}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ManualCheckInForm members={memberOptions} />
        <DeviceManagementPanel devices={devices} canManage={canManageDevices} />
      </div>

      <section className="card p-6">
        <h3 className="text-lg font-semibold">{t('feed.title')}</h3>
        <p className="muted mt-1 text-sm">{t('feed.subtitle')}</p>

        {recentCheckIns.length === 0 ? (
          <p className="muted mt-6 text-sm">{t('feed.empty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {recentCheckIns.map((row) => {
              const name = row.gymMember
                ? `${row.gymMember.firstName} ${row.gymMember.lastName}`
                : (row.staffUser?.name ?? '—');
              const avatarUrl = row.gymMember?.avatarUrl ?? row.staffUser?.avatarUrl ?? null;
              const directionKey = row.direction === 'EXIT' ? 'exit' : 'entry';
              return (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <UserAvatar name={name} avatarUrl={avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="muted text-xs">
                      <span
                        className={
                          row.direction === 'EXIT'
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }
                      >
                        {t(`direction.${directionKey}`)}
                      </span>
                      {' · '}
                      {t(`methods.${row.method.toLowerCase()}`)}
                      {row.device?.name ? ` · ${row.device.name}` : ''}
                    </p>
                  </div>
                  <time className="muted shrink-0 text-xs">
                    {row.checkedInAt.toLocaleTimeString(dateLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
