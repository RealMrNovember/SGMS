import { AddMeasurementForm } from '@/components/add-measurement-form';
import { AvatarUpload } from '@/components/avatar-upload';
import { MemberAccountPanel } from '@/components/member-account-panel';
import { MemberHealthHistoryTable } from '@/components/member-health-history-table';
import { MemberRfidForm } from '@/components/member-rfid-form';
import { MembershipRenewalPanel } from '@/components/membership-renewal-panel';
import { MembershipLifecyclePanel } from '@/components/membership/membership-lifecycle-panel';
import { ProgramContentView } from '@/components/program-content-view';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { decimalToNumber, getMemberAccountSummary } from '@/lib/member-balance';
import { memberCountryLabel } from '@/lib/member-countries';
import { getMemberPaymentPlans } from '@/lib/payment-plans';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const AVATAR_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const ACCOUNT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const MEMBER_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);
const VOID_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);
const FREE_EXTEND_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN']);

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const canManageMeasurements = role ? MEASUREMENT_ROLES.has(role) : false;
  const canUploadAvatar = role ? AVATAR_MANAGER_ROLES.has(role) : false;
  const canManageAccount = role ? ACCOUNT_ROLES.has(role) : false;
  const canVoidExpenses = role ? VOID_ROLES.has(role) : false;
  const canManageMember = role ? MEMBER_MANAGER_ROLES.has(role) : false;
  const canSellMembership = role ? MEMBER_MANAGER_ROLES.has(role) : false;
  const canExtendFree = role ? FREE_EXTEND_ROLES.has(role) : false;

  const t = await getTranslations('members');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [member, accountSummary, expenseCategories, paymentPlans, membershipPlans, pendingFreezes, allMembers] = await Promise.all([
    prisma.gymMember.findFirst({
      where: { id, organizationId },
      include: {
        plan: true,
        trainer: { select: { id: true, name: true, email: true } },
        user: { select: { id: true, name: true, email: true } },
        healthMeasurements: {
          orderBy: { measuredAt: 'desc' },
        },
        trainingPrograms: {
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          include: {
            trainer: { select: { name: true, email: true } },
          },
        },
      },
    }),
    getMemberAccountSummary(organizationId, id),
    prisma.expenseCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, defaultAmount: true },
    }),
    getMemberPaymentPlans(organizationId, id),
    prisma.gymMembershipPlan.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, durationDays: true, price: true, currency: true },
    }),
    prisma.membershipFreeze.findMany({
      where: { organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { gymMember: { select: { firstName: true, lastName: true } } },
    }),
    prisma.gymMember.findMany({
      where: { organizationId, status: { not: 'INACTIVE' } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
      take: 300,
    }),
  ]);

  if (!member) {
    notFound();
  }

  const fullName = `${member.firstName} ${member.lastName}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/dashboard/members" className="muted text-sm hover:text-white">
            {t('backToMembers')}
          </Link>
          <h2 className="mt-4 text-2xl font-semibold">{fullName}</h2>
          <p className="muted mt-2 text-sm">
            <span className="badge">{member.status}</span>
            {member.gender !== 'UNSPECIFIED' ? ` · ${member.gender}` : ''}
            {role ? ` · ${t('viewingAs', { role })}` : ''}
          </p>
        </div>

        <AvatarUpload
          name={fullName}
          currentUrl={member.avatarUrl}
          targetType="gym_member"
          gymMemberId={member.id}
          canUpload={canUploadAvatar}
          size="xl"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h3 className="text-lg font-semibold">{t('detail.profile')}</h3>
          <dl className="muted mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.email')}</dt>
              <dd className="text-white">{member.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.phone')}</dt>
              <dd className="text-white">{member.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>
                {member.isForeignMember
                  ? t('detail.fields.passportNumber')
                  : t('detail.fields.nationalId')}
              </dt>
              <dd className="text-white">
                {member.isForeignMember
                  ? (member.passportNumber ?? '—')
                  : (member.nationalId ?? '—')}
              </dd>
            </div>
            {member.isForeignMember ? (
              <div className="flex justify-between gap-4">
                <dt>{t('detail.fields.nationality')}</dt>
                <dd className="text-white">
                  {memberCountryLabel(member.nationality)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.birthDate')}</dt>
              <dd className="text-white">
                {member.birthDate ? member.birthDate.toLocaleDateString(dateLocale) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.account')}</dt>
              <dd className="text-white">{member.user?.email ?? t('detail.notLinked')}</dd>
            </div>
          </dl>
          <MemberRfidForm
            memberId={member.id}
            currentRfid={member.rfidTag}
            canManage={canManageMember}
          />
        </section>

        <section className="card p-6">
          <h3 className="text-lg font-semibold">{t('detail.membership')}</h3>
          <dl className="muted mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.gymPlan')}</dt>
              <dd className="text-white">{member.plan?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.membershipStart')}</dt>
              <dd className="text-white">
                {member.membershipStartsAt
                  ? member.membershipStartsAt.toLocaleDateString(dateLocale)
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.membershipEnd')}</dt>
              <dd className="text-white">
                {member.membershipEndsAt
                  ? member.membershipEndsAt.toLocaleDateString(dateLocale)
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('detail.fields.trainer')}</dt>
              <dd className="text-white">
                {member.trainer?.name ?? member.trainer?.email ?? t('detail.unassigned')}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {canManageMember ? (
        <MembershipLifecyclePanel
          gymMemberId={member.id}
          memberName={fullName}
          memberStatus={member.status}
          pendingFreezes={pendingFreezes.map((f) => ({
            id: f.id,
            startDate: f.startDate.toISOString(),
            endDate: f.endDate.toISOString(),
            reason: f.reason,
            status: f.status,
            notes: f.notes,
            gymMemberName: `${f.gymMember.firstName} ${f.gymMember.lastName}`,
          }))}
          memberOptions={allMembers.map((m) => ({
            id: m.id,
            label: `${m.firstName} ${m.lastName}`,
          }))}
          canManage={canManageMember}
        />
      ) : null}

      {canSellMembership || canExtendFree ? (
        <MembershipRenewalPanel
          gymMemberId={member.id}
          currentPlanId={member.planId}
          membershipEndsAt={member.membershipEndsAt?.toISOString() ?? null}
          canSell={canSellMembership}
          canExtendFree={canExtendFree}
          plans={membershipPlans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            durationDays: plan.durationDays,
            price: plan.price.toString(),
            currency: plan.currency,
          }))}
        />
      ) : null}

      {member.notes ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">{t('detail.notes')}</h3>
          <p className="muted mt-3 whitespace-pre-wrap text-sm">{member.notes}</p>
        </section>
      ) : null}

      {/* Finansal veri (bakiye, harcama, tahsilat) — yalnızca OWNER/ADMIN/STAFF görebilir.
          TRAINER hiçbir üyenin ödeme/cari bilgisine erişemez (bkz. roadmap.md Faz 36.5). */}
      {canManageAccount ? (
        <MemberAccountPanel
          gymMemberId={member.id}
          canManage={canManageAccount}
          canVoid={canVoidExpenses}
          currency="TRY"
          openBalance={decimalToNumber(accountSummary.openBalance)}
          balancesByCurrency={accountSummary.balancesByCurrency}
          categories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
            defaultAmount: c.defaultAmount?.toString() ?? null,
          }))}
          expenses={accountSummary.recentExpenses.map((e) => ({
            id: e.id,
            description: e.description,
            amount: e.amount.toString(),
            currency: e.currency,
            status: e.status,
            createdAt: e.createdAt.toISOString(),
            category: e.category,
          }))}
          transactions={accountSummary.recentTransactions.map((tx) => ({
            id: tx.id,
            amount: tx.amount.toString(),
            currency: tx.currency,
            type: tx.type,
            paymentMethod: tx.paymentMethod,
            createdAt: tx.createdAt.toISOString(),
            refundedTotal: tx.refunds.reduce((sum, r) => sum + Number(r.amount.toString()), 0),
          }))}
          paymentPlans={paymentPlans.map((plan) => ({
            ...plan,
            installments: plan.installments.map((installment) => ({
              ...installment,
              dueDate: installment.dueDate ? installment.dueDate.toISOString() : null,
            })),
          }))}
        />
      ) : null}

      <AddMeasurementForm gymMemberId={member.id} canManage={canManageMeasurements} />

      <MemberHealthHistoryTable measurements={member.healthMeasurements} />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{t('detail.activePrograms')}</h3>
            <p className="muted mt-1 text-sm">
              {t('detail.programCount', { count: member.trainingPrograms.length })}
            </p>
          </div>
          <Link
            href={`/dashboard/programs?member=${member.id}`}
            className="muted text-sm hover:text-white"
          >
            {t('detail.allPrograms')}
          </Link>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {member.trainingPrograms.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('detail.noPrograms')}</p>
          ) : (
            member.trainingPrograms.map((program) => (
              <article key={program.id} className="px-6 py-4">
                <p className="font-medium">{program.title}</p>
                <p className="muted text-sm">
                  {program.type} · {program.trainer.name ?? program.trainer.email ?? '—'} ·{' '}
                  {program.startDate.toLocaleDateString(dateLocale)}
                  {program.endDate
                    ? ` → ${program.endDate.toLocaleDateString(dateLocale)}`
                    : ''}
                </p>
                <ProgramContentView content={program.content} type={program.type} />
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
