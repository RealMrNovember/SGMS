export type AthleteSession = {
  accessToken: string;
  expiresAt: string;
  organizationId: string;
  gymMemberId: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    locale: string;
  };
};

export type CheckInQrData = {
  token: string;
  expiresAt: string;
  refreshAfterSeconds: number;
};
