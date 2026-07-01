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
  soketiForceTLS?: boolean;
  soketiWsPort?: number;
  soketiWssPort?: number;
  userName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RealtimePublicConfig = {
  enabled: boolean;
  key: string | null;
  wsPath: string;
  forceTLS: boolean;
  wsPort: number;
  wssPort: number;
};
