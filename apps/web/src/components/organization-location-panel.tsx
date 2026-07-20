'use client';

import {
  updateOrganizationLocation,
  type OrganizationLocationState,
} from '@/actions/organization-location';
import { LocationSelect } from '@/components/geo/location-select';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';

const initialState: OrganizationLocationState = {};

export type OrganizationLocationDefaults = {
  countryCode: string;
  countryLabel: string;
  cityId: string;
  cityLabel: string;
  districtId: string;
  districtLabel: string;
};

export function OrganizationLocationPanel({ defaults }: { defaults: OrganizationLocationDefaults }) {
  const t = useTranslations('settings.location');
  const locale = useLocale();
  const [state, action, pending] = useActionState(updateOrganizationLocation, initialState);

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white/5 p-4">
      <div>
        <h4 className="font-semibold">{t('title')}</h4>
        <p className="muted mt-1 text-sm leading-6">{t('subtitle')}</p>
      </div>

      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-400">{state.success}</p> : null}

      <form action={action} className="space-y-3">
        <LocationSelect
          locale={locale}
          namePrefix="location"
          labels={{
            countryPlaceholder: t('countryPlaceholder'),
            cityPlaceholder: t('cityPlaceholder'),
            districtPlaceholder: t('districtPlaceholder'),
            emptyCountry: t('emptyCountry'),
            emptyCity: t('emptyCity'),
            emptyDistrict: t('emptyDistrict'),
          }}
          defaults={{
            countryCode: defaults.countryCode,
            countryLabel: defaults.countryLabel,
            cityId: defaults.cityId,
            cityLabel: defaults.cityLabel,
            districtId: defaults.districtId,
            districtLabel: defaults.districtLabel,
          }}
        />
        <button type="submit" className="button px-4 py-2 text-sm" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </button>
      </form>
    </div>
  );
}
