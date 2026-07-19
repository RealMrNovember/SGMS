import { prisma } from '@/lib/prisma';

export type OrganizationExportPayload = {
  exportedAt: string;
  organizationId: string;
  organizationName: string;
  gymMembers: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  directMessages: Array<Record<string, unknown>>;
};

function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function serializeDecimal(value: { toString(): string } | number | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === 'number' ? value.toFixed(2) : value.toString();
}

export async function buildOrganizationExport(
  organizationId: string,
): Promise<OrganizationExportPayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!org) return null;

  const [gymMembers, expenses, transactions, directMessages] = await Promise.all([
    prisma.gymMember.findMany({
      where: { organizationId },
      include: {
        plan: { select: { name: true } },
        healthConsentBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { organizationId },
      include: {
        category: { select: { name: true } },
        gymMember: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { organizationId },
      include: {
        gymMember: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.directMessage.findMany({
      where: { organizationId },
      include: {
        sender: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organizationId: org.id,
    organizationName: org.name,
    gymMembers: gymMembers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      status: m.status,
      plan: m.plan?.name ?? null,
      membershipStartsAt: serializeDate(m.membershipStartsAt),
      membershipEndsAt: serializeDate(m.membershipEndsAt),
      healthConsentAcceptedAt: serializeDate(m.healthConsentAcceptedAt),
      healthConsentVersion: m.healthConsentVersion,
      healthConsentBy: m.healthConsentBy?.name ?? m.healthConsentBy?.email ?? null,
      createdAt: serializeDate(m.createdAt),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      gymMemberId: e.gymMemberId,
      memberName: e.gymMember ? `${e.gymMember.firstName} ${e.gymMember.lastName}` : null,
      description: e.description,
      amount: serializeDecimal(e.amount),
      currency: e.currency,
      status: e.status,
      category: e.category?.name ?? null,
      createdAt: serializeDate(e.createdAt),
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      gymMemberId: t.gymMemberId,
      memberName: t.gymMember ? `${t.gymMember.firstName} ${t.gymMember.lastName}` : null,
      type: t.type,
      amount: serializeDecimal(t.amount),
      currency: t.currency,
      paymentMethod: t.paymentMethod,
      notes: t.notes,
      createdAt: serializeDate(t.createdAt),
    })),
    directMessages: directMessages.map((dm) => ({
      id: dm.id,
      sender: dm.sender.name ?? dm.sender.email,
      receiver: dm.receiver.name ?? dm.receiver.email,
      content: dm.content,
      isRead: dm.isRead,
      createdAt: serializeDate(dm.createdAt),
    })),
  };
}

export function buildGymMembersCsv(payload: OrganizationExportPayload): string {
  const headers = [
    'id',
    'firstName',
    'lastName',
    'email',
    'phone',
    'status',
    'plan',
    'membershipStartsAt',
    'membershipEndsAt',
    'healthConsentAcceptedAt',
    'healthConsentVersion',
    'createdAt',
  ];

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const rows = payload.gymMembers.map((m) =>
    headers.map((h) => escape(m[h])).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
