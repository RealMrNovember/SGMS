import { randomUUID } from 'crypto';

export type SupportNote = {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
};

export type OrganizationSettings = {
  supportNotes?: SupportNote[];
  licenseError?: string;
  [key: string]: unknown;
};

export function parseOrganizationSettings(raw: unknown): OrganizationSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as OrganizationSettings;
}

export function appendSupportNote(
  settings: OrganizationSettings,
  note: Omit<SupportNote, 'id' | 'createdAt'>,
): OrganizationSettings {
  const existing = settings.supportNotes ?? [];
  return {
    ...settings,
    supportNotes: [
      {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...note,
      },
      ...existing,
    ].slice(0, 50),
  };
}
