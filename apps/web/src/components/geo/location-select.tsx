'use client';

import { CountrySelect } from '@/components/geo/country-select';
import { SearchableSelect, type SearchableOption } from '@/components/geo/searchable-select';
import { useCallback, useState } from 'react';

type LocationSelectLabels = {
  countryPlaceholder: string;
  cityPlaceholder: string;
  districtPlaceholder: string;
  emptyCountry: string;
  emptyCity: string;
  emptyDistrict: string;
};

type LocationSelectDefaults = {
  countryCode?: string;
  countryLabel?: string;
  cityId?: string;
  cityLabel?: string;
  districtId?: string;
  districtLabel?: string;
};

/**
 * Faz 6.4 — Ülke → Şehir → İlçe kademeli seçici. Ülke değişince şehir/ilçe,
 * şehir değişince ilçe sıfırlanır. İlçe alanı yalnızca seçili ülke
 * `hasDistricts` ise gösterilir (bugün yalnızca Türkiye).
 */
export function LocationSelect({
  locale,
  namePrefix,
  labels,
  defaults,
}: {
  locale: string;
  namePrefix: string;
  labels: LocationSelectLabels;
  defaults?: LocationSelectDefaults;
}) {
  const [countryCode, setCountryCode] = useState(defaults?.countryCode ?? '');
  const [hasDistricts, setHasDistricts] = useState(false);
  const [cityId, setCityId] = useState(defaults?.cityId ?? '');
  const [cityKey, setCityKey] = useState(0);
  const [districtKey, setDistrictKey] = useState(0);

  const fetchCities = useCallback(
    async (query: string): Promise<SearchableOption[]> => {
      if (!countryCode) return [];
      const res = await fetch(
        `/api/v1/geo/cities?country=${countryCode}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      );
      const json = await res.json();
      if (!json.ok) return [];
      return (json.data.cities as Array<{ id: string; name: string; population: number }>).map((c) => ({
        value: c.id,
        label: c.name,
      }));
    },
    [countryCode],
  );

  const fetchDistricts = useCallback(
    async (query: string): Promise<SearchableOption[]> => {
      if (!cityId) return [];
      const res = await fetch(
        `/api/v1/geo/districts?cityId=${cityId}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      );
      const json = await res.json();
      if (!json.ok) return [];
      return (json.data.districts as Array<{ id: string; name: string }>).map((d) => ({
        value: d.id,
        label: d.name,
      }));
    },
    [cityId],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <CountrySelect
          name={`${namePrefix}CountryCode`}
          locale={locale}
          defaultValue={defaults?.countryCode}
          defaultLabel={defaults?.countryLabel}
          placeholder={labels.countryPlaceholder}
          emptyMessage={labels.emptyCountry}
          onSelect={(country) => {
            setCountryCode(country?.isoCode ?? '');
            setHasDistricts(country?.hasDistricts ?? false);
            setCityId('');
            setCityKey((k) => k + 1);
            setDistrictKey((k) => k + 1);
          }}
        />
      </div>

      <div className="space-y-2">
        <SearchableSelect
          key={cityKey}
          name={`${namePrefix}CityId`}
          disabled={!countryCode}
          defaultValue={cityKey === 0 ? defaults?.cityId : undefined}
          defaultLabel={cityKey === 0 ? defaults?.cityLabel : undefined}
          placeholder={labels.cityPlaceholder}
          emptyMessage={labels.emptyCity}
          fetchOptions={fetchCities}
          onSelect={(option) => {
            setCityId(option?.value ?? '');
            setDistrictKey((k) => k + 1);
          }}
        />
      </div>

      <div className="space-y-2">
        {hasDistricts || (cityKey === 0 && defaults?.districtId) ? (
          <SearchableSelect
            key={districtKey}
            name={`${namePrefix}DistrictId`}
            disabled={!cityId}
            defaultValue={districtKey === 0 ? defaults?.districtId : undefined}
            defaultLabel={districtKey === 0 ? defaults?.districtLabel : undefined}
            placeholder={labels.districtPlaceholder}
            emptyMessage={labels.emptyDistrict}
            fetchOptions={fetchDistricts}
          />
        ) : (
          <input type="hidden" name={`${namePrefix}DistrictId`} value="" />
        )}
      </div>
    </div>
  );
}
