'use client';

import { useEffect, useRef, useState } from 'react';

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
};

/**
 * Faz 6.4 — harici kütüphane olmadan arama destekli (typeahead) seçici. Bir
 * `<input type="hidden">` ile gerçek değeri (id/ISO kodu) forma taşır, görünen
 * metin kutusu yalnızca arama/gösterim içindir. `fetchOptions` her sorguda
 * (debounce'lu) çağrılır — küçük listeler (ör. ülkeler) sonucu kendi içinde
 * filtreleyebilir, büyük listeler (şehir/ilçe) sunucu tarafı arama yapar.
 */
export function SearchableSelect({
  name,
  defaultValue,
  defaultLabel,
  placeholder,
  emptyMessage,
  fetchOptions,
  onSelect,
  disabled,
  required,
}: {
  name: string;
  defaultValue?: string;
  defaultLabel?: string;
  placeholder: string;
  emptyMessage: string;
  fetchOptions: (query: string) => Promise<SearchableOption[]>;
  onSelect?: (option: SearchableOption | null) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [query, setQuery] = useState(defaultLabel ?? '');
  const [options, setOptions] = useState<SearchableOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setValue(defaultValue ?? '');
    setQuery(defaultLabel ?? '');
  }, [defaultValue, defaultLabel]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function scheduleSearch(nextQuery: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const results = await fetchOptions(nextQuery);
        if (requestId === requestIdRef.current) {
          setOptions(results);
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 250);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <input
        type="text"
        className="input w-full"
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setValue('');
          onSelect?.(null);
          setOpen(true);
          scheduleSearch(next);
        }}
        onFocus={() => {
          setOpen(true);
          if (options.length === 0) scheduleSearch(query);
        }}
        autoComplete="off"
      />
      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {loading ? (
            <p className="muted px-3 py-2 text-xs">…</p>
          ) : options.length === 0 ? (
            <p className="muted px-3 py-2 text-xs">{emptyMessage}</p>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  setValue(option.value);
                  setQuery(option.label);
                  setOpen(false);
                  onSelect?.(option);
                }}
              >
                <span>{option.label}</span>
                {option.sublabel ? <span className="muted text-xs">{option.sublabel}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
