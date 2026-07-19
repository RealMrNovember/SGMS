'use client';

import {
  updateOrganizationSettings,
  type OrganizationSettingsState,
} from '@/actions/organization-settings';
import type { OrganizationSettings } from '@/lib/admin/org-settings';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const LOCALES = ['tr', 'en', 'ru', 'fr', 'es', 'az'] as const;

export function OrganizationSettingsPanel({
  settings,
}: {
  settings: OrganizationSettings;
}) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [state, action, pending] = useActionState(
    updateOrganizationSettings,
    {} as OrganizationSettingsState,
  );

  return (
    <div className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={action} className="space-y-5">
        <label className="block space-y-1 text-sm">
          <span className="muted">{t('general.defaultLocale')}</span>
          <select
            name="defaultLocale"
            defaultValue={settings.defaultLocale ?? 'tr'}
            className="input w-full max-w-xs"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
          <span className="muted block text-xs">{t('general.defaultLocaleHint')}</span>
        </label>

        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
          {pending ? tCommon('ellipsis') : t('save')}
        </button>
      </form>
    </div>
  );
}

export function OrganizationNotificationSettingsPanel({
  settings,
}: {
  settings: OrganizationSettings;
}) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [state, action, pending] = useActionState(
    updateOrganizationSettings,
    {} as OrganizationSettingsState,
  );

  return (
    <div className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <form action={action} className="space-y-5">
        <input type="hidden" name="defaultLocale" value={settings.defaultLocale ?? 'tr'} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="muted">{t('notifications.typingIndicator')}</span>
            <select
              name="typingIndicator"
              defaultValue={settings.features?.typingIndicator === false ? 'off' : 'on'}
              className="input w-full"
            >
              <option value="on">{t('on')}</option>
              <option value="off">{t('off')}</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">{t('notifications.messageReports')}</span>
            <select
              name="messageReports"
              defaultValue={settings.features?.messageReports === false ? 'off' : 'on'}
              className="input w-full"
            >
              <option value="on">{t('on')}</option>
              <option value="off">{t('off')}</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">{t('notifications.signedAvatarUrls')}</span>
            <select
              name="signedAvatarUrls"
              defaultValue={settings.features?.signedAvatarUrls ? 'on' : 'off'}
              className="input w-full"
            >
              <option value="off">{t('notifications.signedOff')}</option>
              <option value="on">{t('notifications.signedOn')}</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="muted">{t('notifications.tokenRevokeRedisCache')}</span>
            <select
              name="tokenRevokeRedisCache"
              defaultValue={settings.features?.tokenRevokeRedisCache ? 'on' : 'off'}
              className="input w-full"
            >
              <option value="off">{t('off')}</option>
              <option value="on">{t('on')}</option>
            </select>
          </label>
        </div>

        <button type="submit" className="button button-gold px-4 py-2 text-sm" disabled={pending}>
          {pending ? tCommon('ellipsis') : t('save')}
        </button>
      </form>
    </div>
  );
}
