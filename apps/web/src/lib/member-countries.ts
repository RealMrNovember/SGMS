/** Üye kaydı — yabancı üye ülke seçimi (ISO 3166-1 alpha-2) */
export const memberCountryOptions = [
  { code: 'TR', label: 'Türkiye' },
  { code: 'DE', label: 'Almanya' },
  { code: 'GB', label: 'Birleşik Krallık' },
  { code: 'US', label: 'ABD' },
  { code: 'RU', label: 'Rusya' },
  { code: 'UA', label: 'Ukrayna' },
  { code: 'AZ', label: 'Azerbaycan' },
  { code: 'GE', label: 'Gürcistan' },
  { code: 'IQ', label: 'Irak' },
  { code: 'SY', label: 'Suriye' },
  { code: 'IR', label: 'İran' },
  { code: 'SA', label: 'Suudi Arabistan' },
  { code: 'AE', label: 'BAE' },
  { code: 'FR', label: 'Fransa' },
  { code: 'IT', label: 'İtalya' },
  { code: 'ES', label: 'İspanya' },
  { code: 'NL', label: 'Hollanda' },
  { code: 'BE', label: 'Belçika' },
  { code: 'KZ', label: 'Kazakistan' },
  { code: 'UZ', label: 'Özbekistan' },
  { code: 'OTHER', label: 'Diğer' },
] as const;

export function memberCountryLabel(code: string | null | undefined): string {
  if (!code) return '—';
  const found = memberCountryOptions.find((c) => c.code === code);
  return found?.label ?? code;
}
