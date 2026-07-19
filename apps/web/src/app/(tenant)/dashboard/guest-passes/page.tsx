import { GuestPassIssueForm, GuestPassRevokeButton } from '@/components/guest-passes/guest-pass-forms';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function GuestPassesPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz17.guestPass');

  const [passes, members] = await Promise.all([
    prisma.guestPass.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { hostMember: { select: { firstName: true, lastName: true } } },
    }),
    prisma.gymMember.findMany({
      where: { organizationId, status: { not: 'INACTIVE' } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <GuestPassIssueForm
        members={members.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }))}
      />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('recentTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {passes.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('empty')}</p>
          ) : (
            passes.map((pass) => (
              <article key={pass.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{pass.guestName}</p>
                  <p className="muted text-sm">
                    {pass.validFrom.toLocaleDateString()} → {pass.validUntil.toLocaleDateString()}
                    {pass.hostMember
                      ? ` · ${pass.hostMember.firstName} ${pass.hostMember.lastName}`
                      : ''}
                    {pass.usedAt ? ` · ${t('used')}` : ''}
                    {pass.revokedAt ? ` · ${t('revoked')}` : ''}
                  </p>
                </div>
                {!pass.revokedAt && !pass.usedAt ? <GuestPassRevokeButton passId={pass.id} /> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
