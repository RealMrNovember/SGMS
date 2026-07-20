'use client';

import {
  OrganizationNotificationSettingsPanel,
  OrganizationSettingsPanel,
} from '@/components/organization-settings-panel';
import { PrivacySettingsPanel } from '@/components/settings/privacy-settings-panel';
import {
  TenantPaymentGatewayPanel,
  type TenantPaymentSettingsProps,
} from '@/components/settings/tenant-payment-gateway-panel';
import {
  OrganizationLocationPanel,
  type OrganizationLocationDefaults,
} from '@/components/organization-location-panel';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';
import type { OrganizationSettings } from '@/lib/admin/org-settings';
import type { OrganizationRole } from '@sgms/database';
import {
  Bell,
  CreditCard,
  Link2,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type SettingsTabId =
  | 'general'
  | 'team'
  | 'notifications'
  | 'billing'
  | 'integrations'
  | 'privacy'
  | 'security';

type TabDef = {
  id: SettingsTabId;
  roles: OrganizationRole[];
  helpSlug: string;
  icon: React.ReactNode;
};

const TAB_DEFS: TabDef[] = [
  {
    id: 'general',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-settings',
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    id: 'team',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-team',
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: 'notifications',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-settings',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: 'billing',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-billing',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: 'integrations',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-integrations',
    icon: <Link2 className="h-4 w-4" />,
  },
  {
    id: 'privacy',
    roles: ['OWNER', 'ADMIN'],
    helpSlug: 'topic-settings',
    icon: <Lock className="h-4 w-4" />,
  },
  {
    id: 'security',
    roles: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'VIEWER'],
    helpSlug: 'topic-security',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

export function SettingsWorkspace({
  role,
  orgName,
  settings,
  contractTemplateName,
  contractTemplateBody,
  paymentGatewaySettings,
  locationDefaults,
}: {
  role: OrganizationRole;
  orgName: string;
  settings: OrganizationSettings;
  contractTemplateName?: string;
  contractTemplateBody?: string;
  paymentGatewaySettings?: TenantPaymentSettingsProps | null;
  locationDefaults?: OrganizationLocationDefaults | null;
}) {
  const t = useTranslations('settings');
  const visibleTabs = useMemo(
    () => TAB_DEFS.filter((tab) => tab.roles.includes(role)),
    [role],
  );
  const [active, setActive] = useState<SettingsTabId>(visibleTabs[0]?.id ?? 'security');
  const current = visibleTabs.find((tab) => tab.id === active) ?? visibleTabs[0];

  if (!current) {
    return (
      <section className="card p-6">
        <p className="muted text-sm">{t('noAccess')}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
        <p className="muted mt-2 text-sm leading-6">{t('subtitle', { name: orgName })}</p>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="card flex shrink-0 flex-row gap-1 overflow-x-auto p-2 lg:w-56 lg:flex-col">
          {visibleTabs.map((tab) => {
            const selected = tab.id === current.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap ${
                  selected
                    ? 'bg-[var(--gold)]/15 text-[var(--gold)]'
                    : 'text-[var(--muted)] hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{t(`tabs.${tab.id}`)}</span>
              </button>
            );
          })}
        </nav>

        <section className="card min-w-0 flex-1 space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{t(`tabs.${current.id}`)}</h3>
              <p className="muted mt-1 text-sm leading-6">{t(`sections.${current.id}.subtitle`)}</p>
            </div>
            <div className="flex items-center gap-2">
              <ContextualHelpButton topic={current.helpSlug} />
              <Link href={`/help/${current.helpSlug}`} className="muted text-xs hover:text-white">
                {t('openHelp')}
              </Link>
            </div>
          </div>

          {current.id === 'general' ? (
            <div className="space-y-5">
              <OrganizationSettingsPanel settings={settings} />
              {locationDefaults ? <OrganizationLocationPanel defaults={locationDefaults} /> : null}
            </div>
          ) : null}

          {current.id === 'team' ? (
            <div className="space-y-3">
              <p className="muted text-sm leading-6">{t('sections.team.body')}</p>
              <Link href="/dashboard/team" className="button button-gold inline-flex px-4 py-2 text-sm">
                {t('sections.team.cta')}
              </Link>
            </div>
          ) : null}

          {current.id === 'notifications' ? (
            <OrganizationNotificationSettingsPanel settings={settings} />
          ) : null}

          {current.id === 'billing' ? (
            <div className="space-y-3">
              <p className="muted text-sm leading-6">{t('sections.billing.body')}</p>
              <Link
                href="/dashboard/billing"
                className="button button-gold inline-flex px-4 py-2 text-sm"
              >
                {t('sections.billing.cta')}
              </Link>
            </div>
          ) : null}

          {current.id === 'integrations' ? (
            <div className="space-y-5">
              {paymentGatewaySettings ? (
                <TenantPaymentGatewayPanel
                  iyzico={paymentGatewaySettings.iyzico}
                  paytr={paymentGatewaySettings.paytr}
                  bankTransfer={paymentGatewaySettings.bankTransfer}
                />
              ) : (
                <p className="muted text-sm leading-6">{t('sections.integrations.body')}</p>
              )}
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/5 p-4">
                <p className="text-sm font-medium">{t('sections.integrations.prepTitle')}</p>
                <ul className="muted mt-2 list-disc space-y-1 pl-5 text-sm">
                  <li>{t('sections.integrations.itemHardware')}</li>
                </ul>
              </div>
            </div>
          ) : null}

          {current.id === 'privacy' && contractTemplateName && contractTemplateBody ? (
            <PrivacySettingsPanel
              contractTemplateName={contractTemplateName}
              contractTemplateBody={contractTemplateBody}
            />
          ) : null}

          {current.id === 'security' ? (
            <div className="space-y-3">
              <p className="muted text-sm leading-6">{t('sections.security.body')}</p>
              <Link
                href="/dashboard/account/security"
                className="button button-gold inline-flex px-4 py-2 text-sm"
              >
                {t('sections.security.cta')}
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
