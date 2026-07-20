'use client';

import { SearchableSelect, type SearchableOption } from '@/components/geo/searchable-select';
import { useCallback, useRef } from 'react';

type CountryApiResult = {
  isoCode: string;
  name: string;
  callingCode: string | null;
  hasDistricts: boolean;
};

/** Faz 6.4 — 250 ülke küçük bir liste olduğundan tek seferde çekilip istemci tarafında filtrelenir. */
export function CountrySelect({
  name,
  locale,
  defaultValue,
  defaultLabel,
  placeholder,
  emptyMessage,
  required,
  onSelect,
}: {
  name: string;
  locale: string;
  defaultValue?: string;
  defaultLabel?: string;
  placeholder: string;
  emptyMessage: string;
  required?: boolean;
  onSelect?: (country: CountryApiResult | null) => void;
}) {
  const cacheRef = useRef<CountryApiResult[] | null>(null);

  const fetchOptions = useCallback(
    async (query: string): Promise<SearchableOption[]> => {
      if (!cacheRef.current) {
        const res = await fetch(`/api/v1/geo/countries?locale=${locale}`);
        const json = await res.json();
        cacheRef.current = json.ok ? (json.data.countries as CountryApiResult[]) : [];
      }
      const list = cacheRef.current ?? [];
      const q = query.trim().toLocaleLowerCase(locale);
      const filtered = q ? list.filter((c) => c.name.toLocaleLowerCase(locale).includes(q)) : list;
      return filtered.slice(0, 30).map((c) => ({ value: c.isoCode, label: c.name }));
    },
    [locale],
  );

  return (
    <SearchableSelect
      name={name}
      defaultValue={defaultValue}
      defaultLabel={defaultLabel}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      required={required}
      fetchOptions={fetchOptions}
      onSelect={(option) => {
        if (!option) {
          onSelect?.(null);
          return;
        }
        const found = cacheRef.current?.find((c) => c.isoCode === option.value) ?? null;
        onSelect?.(found);
      }}
    />
  );
}
