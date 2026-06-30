import { AdminBadge } from '@/components/admin/admin-badge';
import { CopyEmailBlock } from '@/components/admin/copy-email-block';
import { OrganizationAdminActions } from '@/components/admin/organization-admin-actions';
import { OrganizationQuickActions } from '@/components/admin/organization-quick-actions';
import { auth } from '@/lib/auth';
import { adminEmailTemplates, fillEmailTemplate } from '@/lib/admin/email-templates';
import {
  daysUntil,
  formatDateTimeTr,
  formatDateTr,
  formatSubscriptionKind,
  licenseTone,
  organizationTone,
  subscriptionTone,
} from '@/lib/admin/format';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { getOrganizationAdminDetail, listActivePlans } from '@/lib/admin/queries';
import { siteConfig } from '@/lib/site-config';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const tAdmin = await getTranslations('admin');

  const [org, plans] = await Promise.all([getOrganizationAdminDetail(id), listActivePlans()]);

  if (!org) {
    notFound();
  }

  const subscription = org.subscriptions[0] ?? null;
  const ownerMember = org.members.find((m) => m.role === 'OWNER') ?? org.members[0];
  const owner = ownerMember?.user ?? null;
  const settings = parseOrganizationSettings(org.settings);
  const trialDays = daysUntil(subscription?.trialEndsAt ?? org.licenseExpiresAt);
  const isTrialing = subscription?.status === 'TRIALING';

  const emailVars = {
    salonAdi: org.name,
    sahipAdi: owner?.name ?? 'Yetkili',
    denemeGun: String(siteConfig.trialDays),
    denemeBitis: formatDateTr(subscription?.trialEndsAt ?? org.licenseExpiresAt),
    kalanGun: trialDays !== null ? String(Math.max(trialDays, 0)) : '—',
    mevcutPlan: subscription?.plan.name ?? '—',
    planAdi: 'Pro',
    not: settings.supportNotes?.[0]?.text ?? '',
    sebep: settings.licenseError ?? 'Lisans veya ödeme durumu',
  };

  const welcomeTemplate = adminEmailTemplates.find((t) => t.id === 'welcome-trial');
  const filledWelcome = welcomeTemplate
    ? fillEmailTemplate(welcomeTemplate, emailVars)
    : { subject: '', body: '' };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/organizations" className="muted text-sm hover:underline">
            ← {tAdmin('backToCustomers')}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{org.name}</h2>
          <p className="muted mt-1 text-sm">
            {org.slug} · {org.country} · {org.email ?? owner?.email ?? 'E-posta yok'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminBadge label={org.status} tone={organizationTone(org.status)} />
            <AdminBadge
              label={formatSubscriptionKind(subscription?.status)}
              tone={subscriptionTone(subscription?.status)}
            />
            <AdminBadge label={org.centralLicenseStatus} tone={licenseTone(org.centralLicenseStatus)} />
          </div>
        </div>
        <OrganizationQuickActions organizationId={org.id} status={org.status} />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">{tAdmin('cardOwner')}</p>
          <p className="mt-2 font-medium">{owner?.name ?? '—'}</p>
          <a href={`mailto:${owner?.email ?? ''}`} className="muted text-sm hover:underline">
            {owner?.email ?? '—'}
          </a>
          <p className="muted mt-2 text-xs">Son giriş: {formatDateTimeTr(owner?.lastLoginAt)}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">{tAdmin('cardSubscription')}</p>
          <p className="mt-2 font-medium">{subscription?.plan.name ?? '—'}</p>
          <p className="muted text-sm">{formatSubscriptionKind(subscription?.status)}</p>
          {isTrialing && trialDays !== null ? (
            <p className="mt-2 text-sm text-amber-200">{tAdmin('daysLeft', { count: trialDays })}</p>
          ) : null}
          <p className="muted mt-2 text-xs">Bitiş: {formatDateTr(subscription?.trialEndsAt ?? subscription?.currentPeriodEnd ?? org.licenseExpiresAt)}</p>
        </article>
        <article className="admin-stat rounded-2xl p-5">
          <p className="admin-kicker">{tAdmin('cardLicense')}</p>
          <p className="mt-2 font-medium">{org.centralLicenseType ?? org.centralLicenseStatus}</p>
          <p className="muted text-sm">HWID: {org.installationId.slice(0, 8)}…</p>
          <p className="muted mt-2 text-xs">Son kontrol: {formatDateTimeTr(org.lastLicenseCheckAt)}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="card p-4 text-center">
          <p className="text-2xl font-semibold">{org._count.gymMembers}</p>
          <p className="muted text-xs">{tAdmin('usageMembers')}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-2xl font-semibold">{org._count.members}</p>
          <p className="muted text-xs">{tAdmin('usageStaff')}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-2xl font-semibold">{org._count.devices}</p>
          <p className="muted text-xs">{tAdmin('usageDevices')}</p>
        </article>
        <article className="card p-4 text-center">
          <p className="text-2xl font-semibold">{org._count.directMessages}</p>
          <p className="muted text-xs">{tAdmin('usageMessages')}</p>
        </article>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">{tAdmin('actionsTitle')}</h3>
        <OrganizationAdminActions
          organizationId={org.id}
          plans={plans.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
          isTrialing={isTrialing}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{tAdmin('supportNotesTitle')}</h3>
          {settings.supportNotes?.length ? (
            <ul className="space-y-3">
              {settings.supportNotes.map((note) => (
                <li key={note.id} className="card p-4">
                  <p className="text-sm leading-6">{note.text}</p>
                  <p className="muted mt-2 text-xs">
                    {note.createdBy} · {formatDateTimeTr(new Date(note.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">{tAdmin('noSupportNotes')}</p>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{tAdmin('quickEmailTitle')}</h3>
          {owner?.email ? (
            <CopyEmailBlock to={owner.email} subject={filledWelcome.subject} body={filledWelcome.body} />
          ) : (
            <p className="muted text-sm">{tAdmin('noOwnerEmail')}</p>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{tAdmin('teamTitle')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Ad</th>
                <th className="px-6 py-3">E-posta</th>
                <th className="px-6 py-3">Rol</th>
                <th className="px-6 py-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {org.members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--border)] last:border-none">
                  <td className="px-6 py-4">{member.user.name}</td>
                  <td className="px-6 py-4">
                    <a href={`mailto:${member.user.email}`} className="hover:underline">
                      {member.user.email}
                    </a>
                  </td>
                  <td className="px-6 py-4">{member.role}</td>
                  <td className="px-6 py-4">{member.isActive ? 'Aktif' : 'Pasif'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{tAdmin('auditTitle')}</h3>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {org.auditLogs.map((log) => (
            <li key={log.id} className="px-6 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="muted text-xs">{formatDateTimeTr(log.createdAt)}</span>
              </div>
              <p className="muted mt-1 text-xs">
                {log.actor?.name ?? 'Sistem'}
                {log.actor?.email ? ` · ${log.actor.email}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
