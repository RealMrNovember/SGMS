import { routing, type AppLocale } from '@/i18n/routing';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { prisma } from '@/lib/prisma';

export function normalizeAppLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') {
    return null;
  }
  const code = value.toLowerCase().split('-')[0] as AppLocale;
  return routing.locales.includes(code) ? code : null;
}

export async function getOrganizationDefaultLocale(
  organizationId: string | null | undefined,
): Promise<AppLocale | null> {
  if (!organizationId) {
    return null;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!org) {
    return null;
  }

  const settings = parseOrganizationSettings(org.settings);
  return normalizeAppLocale(settings.defaultLocale);
}

export async function resolveUserLocaleChain(input: {
  cookieLocale?: string | null;
  sessionLocale?: string | null;
  organizationId?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): Promise<AppLocale> {
  const fromCookie = normalizeAppLocale(input.cookieLocale);
  if (fromCookie) {
    return fromCookie;
  }

  const fromSession = normalizeAppLocale(input.sessionLocale);
  if (fromSession) {
    return fromSession;
  }

  const fromOrg = await getOrganizationDefaultLocale(input.organizationId);
  if (fromOrg) {
    return fromOrg;
  }

  if (input.acceptLanguage || input.country) {
    const { detectAutoLocale } = await import('@/i18n/detect-locale');
    return detectAutoLocale({ country: input.country, acceptLanguage: input.acceptLanguage });
  }

  return routing.defaultLocale;
}
