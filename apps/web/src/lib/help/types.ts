import type { HelpAudience, OrganizationRole } from '@sgms/database';

export const HELP_LOCALES = ['tr', 'en', 'ru', 'fr', 'es', 'az', 'it', 'pt'] as const;
export type HelpLocale = (typeof HELP_LOCALES)[number];

export const HELP_CATEGORIES = [
  'onboarding',
  'checkin',
  'pos',
  'members',
  'programs',
  'settings',
  'billing',
  'security',
  'integrations',
  'general',
] as const;

export type HelpCategory = (typeof HELP_CATEGORIES)[number];

/** Sayfa yolu → bağlamsal kılavuz slug */
export const HELP_TOPIC_BY_PATH: Record<string, string> = {
  '/dashboard': 'guide-owner-onboarding',
  '/dashboard/pos': 'topic-pos',
  '/dashboard/check-in': 'topic-checkin',
  '/dashboard/members': 'topic-members',
  '/dashboard/programs': 'topic-programs',
  '/dashboard/settings': 'topic-settings',
  '/dashboard/billing': 'topic-billing',
  '/dashboard/team': 'topic-team',
  '/dashboard/account/security': 'topic-security',
  '/athlete': 'guide-athlete-onboarding',
  '/athlete/account': 'guide-athlete-onboarding',
};

export function audiencesForViewer(params: {
  role?: OrganizationRole | null;
  isAthlete?: boolean;
  isSuperAdmin?: boolean;
}): HelpAudience[] {
  if (params.isSuperAdmin) {
    return ['OWNER', 'ADMIN', 'STAFF', 'TRAINER', 'ATHLETE', 'RECEPTION'];
  }
  if (params.isAthlete) {
    return ['ATHLETE'];
  }
  switch (params.role) {
    case 'OWNER':
      return ['OWNER', 'ADMIN'];
    case 'ADMIN':
      return ['ADMIN', 'OWNER'];
    case 'STAFF':
      return ['STAFF', 'RECEPTION'];
    case 'TRAINER':
      return ['TRAINER'];
    case 'VIEWER':
      // Sporcu portalı oturumları VIEWER rolü taşır
      return ['ATHLETE'];
    default:
      if (params.isAthlete) return ['ATHLETE'];
      return ['STAFF'];
  }
}

export function preferredTranslationLocales(locale: string): string[] {
  const normalized = locale.toLowerCase().slice(0, 2);
  const fallbacks = [normalized, 'en', 'tr'];
  return [...new Set(fallbacks)];
}
