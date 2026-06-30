import { InviteTeamForm } from '@/components/invite-team-form';
import { StaffRfidField } from '@/components/staff-rfid-field';
import { UserAvatar } from '@/components/user-avatar';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const t = await getTranslations('team');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [organization, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, slug: true },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const canInvite = session.user.role ? MANAGER_ROLES.has(session.user.role) : false;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          {t('subtitle', {
            orgName: organization?.name ?? '—',
            slug: organization?.slug ?? '—',
          })}
        </p>
      </div>

      <InviteTeamForm canInvite={canInvite} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
          <p className="muted mt-1 text-sm">{t('listCount', { count: members.length })}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">{t('columns.name')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.email')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.role')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.rfid')}</th>
                <th className="px-6 py-3 font-medium">{t('columns.joined')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--border)] last:border-none">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={member.user.name ?? member.user.email}
                        avatarUrl={member.user.avatarUrl}
                        size="sm"
                      />
                      <span className="font-medium">{member.user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{member.user.email}</td>
                  <td className="px-6 py-4">
                    <span className="badge">{member.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StaffRfidField
                      membershipId={member.id}
                      currentRfid={member.rfidTag}
                      canManage={canInvite}
                    />
                  </td>
                  <td className="muted px-6 py-4">
                    {(member.joinedAt ?? member.invitedAt ?? member.createdAt).toLocaleDateString(
                      dateLocale,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
