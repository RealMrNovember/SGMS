export type CheckInNotificationPayload = {
  id: string;
  subjectType: string;
  direction: 'ENTRY' | 'EXIT';
  personName: string;
  subtitle: string;
  checkedInAt: string;
  method: string;
  deviceName: string | null;
  avatarUrl?: string | null;
  role?: string | null;
};

export type ReceptionConfig = {
  apiBaseUrl: string;
  accessToken: string;
  organizationId: string;
  organizationName: string;
  soketiKey: string;
  soketiWsPath: string;
  userName: string;
};

export type LoginInput = {
  apiBaseUrl: string;
  email: string;
  password: string;
  soketiKey: string;
  soketiWsPath: string;
};
