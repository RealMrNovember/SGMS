import { decimalToNumber, getMemberOpenBalance } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';

export type MemberStatementRow = {
  type: string;
  date: Date;
  description: string;
  amount: number;
  status?: string;
  paymentMethod?: string;
};

export type MemberStatementData = {
  organizationName: string;
  memberName: string;
  memberId: string;
  currency: string;
  openBalance: number;
  generatedAt: Date;
  charges: MemberStatementRow[];
  payments: MemberStatementRow[];
};

export async function loadMemberStatementData(
  organizationId: string,
  gymMemberId: string,
): Promise<MemberStatementData | null> {
  const member = await prisma.gymMember.findFirst({
    where: { id: gymMemberId, organizationId },
    include: {
      organization: { select: { name: true } },
      plan: { select: { currency: true } },
    },
  });

  if (!member) {
    return null;
  }

  const [expenses, transactions, openBalance] = await Promise.all([
    prisma.expense.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'asc' },
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { organizationId, gymMemberId },
      orderBy: { createdAt: 'asc' },
    }),
    getMemberOpenBalance(organizationId, gymMemberId),
  ]);

  const currency = member.plan?.currency ?? 'TRY';
  const memberName = `${member.firstName} ${member.lastName}`.trim();

  return {
    organizationName: member.organization.name,
    memberName,
    memberId: member.id,
    currency,
    openBalance: decimalToNumber(openBalance),
    generatedAt: new Date(),
    charges: expenses.map((expense) => ({
      type: 'CHARGE',
      date: expense.createdAt,
      description: expense.description ?? expense.category?.name ?? '',
      amount: decimalToNumber(expense.amount),
      status: expense.status,
    })),
    payments: transactions.map((tx) => ({
      type: tx.type,
      date: tx.createdAt,
      description: tx.notes ?? tx.reference ?? '',
      amount: decimalToNumber(tx.amount),
      paymentMethod: tx.paymentMethod ?? undefined,
    })),
  };
}

function statementFilename(memberName: string, generatedAt: Date, extension: string) {
  const safeName = memberName.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const date = generatedAt.toISOString().slice(0, 10);
  return `statement_${safeName}_${date}.${extension}`;
}

function csvEscape(value: string | number | null | undefined) {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(cells: Array<string | number | null | undefined>) {
  return `${cells.map(csvEscape).join(',')}\n`;
}

export async function buildMemberStatementCsv(organizationId: string, gymMemberId: string) {
  const data = await loadMemberStatementData(organizationId, gymMemberId);
  if (!data) {
    return null;
  }

  let csv = '\uFEFF';
  csv += csvRow(['SGMS Member Statement']);
  csv += csvRow(['Organization', data.organizationName]);
  csv += csvRow(['Member', data.memberName]);
  csv += csvRow(['Member ID', data.memberId]);
  csv += csvRow(['Currency', data.currency]);
  csv += csvRow(['Open Balance', data.openBalance]);
  csv += csvRow(['Generated At', data.generatedAt.toISOString()]);
  csv += '\n';
  csv += csvRow(['Type', 'Date', 'Description', 'Amount', 'Status', 'Payment Method']);
  csv += csvRow(['--- CHARGES ---']);

  for (const row of data.charges) {
    csv += csvRow([
      row.type,
      row.date.toISOString(),
      row.description,
      row.amount,
      row.status ?? '',
      '',
    ]);
  }

  csv += csvRow(['--- PAYMENTS ---']);

  for (const row of data.payments) {
    csv += csvRow([
      row.type,
      row.date.toISOString(),
      row.description,
      row.amount,
      '',
      row.paymentMethod ?? '',
    ]);
  }

  return {
    csv,
    filename: statementFilename(data.memberName, data.generatedAt, 'csv'),
    memberName: data.memberName,
    currency: data.currency,
    openBalance: data.openBalance,
  };
}
