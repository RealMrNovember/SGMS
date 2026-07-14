import { BillingCheckoutPanel } from '@/components/billing/billing-checkout-panel';
import { BillingStatusPoller } from '@/components/billing/billing-status-poller';
import { auth } from '@/lib/auth';
import { getPendingBillingRequest, parseBillingSettings } from '@/lib/billing/settings';
import { resolveSubscriptionAccess } from '@/lib/billing/subscription-gate';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_id?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId || session.user.isSuperAdmin) {
    redirect('/login');
  }

  const checkoutReturn = await searchParams;

  const orgId = session.user.organizationId;
  const t = await getTranslations('billing');

  const [access, org, plans] = await Promise.all([
    resolveSubscriptionAccess(orgId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, settings: true, country: true },
    }),
    prisma.plan.findMany({
      where: { isActive: true, currency: 'TRY' },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!org) {
    redirect('/login');
  }

  const settings = parseBillingSettings(org.settings);
  const pending = getPendingBillingRequest(settings);
  const locked = access.mode === 'billing_only';

  const planOptions = plans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly.toString(),
    priceYearly: p.priceYearly.toString(),
    currency: p.currency,
    maxMembers: p.maxMembers,
    maxStaff: p.maxStaff,
  }));

  const reasonCopy: Record<string, string> = {
    trial_active: t('reason.trialActive', { days: access.daysRemaining ?? 0 }),
    paid_active: t('reason.paidActive'),
    trial_expired: t('reason.trialExpired'),
    subscription_expired: t('reason.subscriptionExpired'),
    payment_overdue: t('reason.paymentOverdue'),
    license_expired: t('reason.licenseExpired'),
    org_suspended: t('reason.orgSuspended'),
    no_subscription: t('reason.noSubscription'),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <BillingStatusPoller enabled={locked || Boolean(pending)} locked={locked} />

      {checkoutReturn.payment_id ? (
        <section
          className={`rounded-xl border px-5 py-4 text-sm ${
            checkoutReturn.status === 'succeeded'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          }`}
        >
          {checkoutReturn.status === 'succeeded'
            ? t('checkoutReturnSuccess')
            : t('checkoutReturnFailed')}
        </section>
      ) : null}

      <section className="space-y-3">
        {locked ? (
          <p className="admin-kicker">{t('lockedKicker')}</p>
        ) : (
          <Link href="/dashboard" className="muted text-sm hover:underline">
            ← {t('backToDashboard')}
          </Link>
        )}
        <h2 className="text-2xl font-semibold tracking-tight">
          {locked ? t('lockedTitle') : t('title')}
        </h2>
        <p className="muted max-w-2xl text-sm leading-7">
          {reasonCopy[access.reason] ?? t('subtitle')}
        </p>
        {!locked && access.daysRemaining !== null && access.reason === 'trial_active' ? (
          <p className="text-sm text-amber-200">
            {t('trialReminder', { days: access.daysRemaining })}
          </p>
        ) : null}
      </section>

      {locked ? (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {t('lockedBanner')}
        </section>
      ) : null}

      <BillingCheckoutPanel
        organizationName={org.name}
        plans={planOptions}
        hasPendingRequest={Boolean(pending)}
        locked={locked}
      />
    </div>
  );
}
