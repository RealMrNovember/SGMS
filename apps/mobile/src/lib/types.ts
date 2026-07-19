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

export type MeResponse = {
  scope: 'athlete';
  user: { id: string; email: string; name: string; locale: string };
  organization: { id: string; name: string; slug: string };
  gymMember: {
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    locale: string;
    membershipStartsAt: string | null;
    membershipEndsAt: string | null;
    plan: { id: string; name: string; durationDays: number; price: unknown; currency: string } | null;
    trainer: { id: string; name: string; email: string } | null;
  };
  stats: {
    measurements: number;
    activePrograms: number;
    unreadMessages: number;
    openBalance: number;
    currency: string;
  };
};

export type TrainingProgram = {
  id: string;
  title: string;
  type: 'WORKOUT' | 'NUTRITION';
  content: unknown;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  trainer: { id: string; name: string; email: string } | null;
};

export type HealthMeasurement = {
  id: string;
  weight: string | number | null;
  bodyFatPercentage: string | number | null;
  muscleMass: string | number | null;
  height: string | number | null;
  notes: string | null;
  measuredAt: string;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
  sender?: { id: string; name: string; email: string };
  receiver?: { id: string; name: string; email: string };
};

export type MemberStatement = {
  openBalance: number;
  balancesByCurrency: Record<string, number>;
  recentExpenses: Array<{
    id: string;
    description: string | null;
    category: string | null;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    paymentMethod: string | null;
    createdAt: string;
  }>;
  paymentPlans: Array<{
    id: string;
    description: string | null;
    installmentCount: number;
    status: string;
    installments: Array<{
      id: string;
      amount: number;
      paidAmount: number;
      status: string;
      dueDate: string | null;
      description: string | null;
    }>;
  }>;
};

export type UpdateInfo = {
  available: boolean;
  version: string;
  downloadUrl: string;
  notes?: string;
};
