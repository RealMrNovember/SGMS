export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  return window.reception.apiRequest(method, path, body) as Promise<ApiResult<T>>;
}

export type GymMemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  nationalId?: string | null;
  avatarUrl?: string | null;
  plan?: { id: string; name: string } | null;
  trainer?: { id: string; name: string } | null;
};

export async function fetchMembers(search = '') {
  const result = await apiRequest<{ members: GymMemberRow[] }>('GET', '/api/v1/members?limit=200');
  if (!result.ok || !result.data?.members) {
    throw new Error(result.error ?? 'Üye listesi alınamadı');
  }

  const q = search.trim().toLowerCase();
  if (!q) {
    return result.data.members;
  }

  return result.data.members.filter((member) => {
    const haystack = [
      member.firstName,
      member.lastName,
      member.phone ?? '',
      member.nationalId ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function fetchMemberDetail(id: string) {
  const result = await apiRequest<{ member: GymMemberRow & { email?: string | null; rfidTag?: string | null } }>(
    'GET',
    `/api/v1/members/${id}`,
  );
  if (!result.ok || !result.data?.member) {
    throw new Error(result.error ?? 'Üye detayı alınamadı');
  }
  return result.data.member;
}

export async function createMember(input: {
  firstName: string;
  lastName: string;
  phone?: string;
  nationalId?: string;
}) {
  return apiRequest('POST', '/api/v1/members', input);
}

export async function manualCheckIn(gymMemberId: string, direction: 'ENTRY' | 'EXIT' = 'ENTRY') {
  return apiRequest('POST', '/api/v1/check-in', { gymMemberId, direction });
}

export async function fetchOpenBalance(gymMemberId: string) {
  const result = await apiRequest<{
    expenses: Array<{ id: string; amount: string; description: string | null; status: string; category?: { name: string } | null }>;
  }>('GET', `/api/v1/expenses?gymMemberId=${gymMemberId}&status=OPEN&limit=100`);

  if (!result.ok || !result.data?.expenses) {
    return { balance: 0, expenses: [] as Array<{ id: string; amount: string; description: string | null; category?: { name: string } | null }> };
  }

  const balance = result.data.expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  return { balance, expenses: result.data.expenses };
}

export async function addExpense(gymMemberId: string, amount: number, description: string) {
  return apiRequest('POST', '/api/v1/expenses', {
    gymMemberId,
    amount,
    description,
    currency: 'TRY',
  });
}

export async function recordPayment(
  gymMemberId: string,
  amount: number,
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER',
) {
  return apiRequest('POST', '/api/v1/transactions', {
    gymMemberId,
    amount,
    paymentMethod,
    type: 'PAYMENT',
    currency: 'TRY',
  });
}
