import { decimalToNumber, getMemberOpenBalance } from '@/lib/member-balance';
import { prisma } from '@/lib/prisma';

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
  const generatedAt = new Date().toISOString();

  let csv = '\uFEFF';
  csv += csvRow(['SGMS Member Statement']);
  csv += csvRow(['Organization', member.organization.name]);
  csv += csvRow(['Member', memberName]);
  csv += csvRow(['Member ID', member.id]);
  csv += csvRow(['Currency', currency]);
  csv += csvRow(['Open Balance', decimalToNumber(openBalance)]);
  csv += csvRow(['Generated At', generatedAt]);
  csv += '\n';
  csv += csvRow(['Type', 'Date', 'Description', 'Amount', 'Status', 'Payment Method']);
  csv += csvRow(['--- CHARGES ---']);

  for (const expense of expenses) {
    csv += csvRow([
      'CHARGE',
      expense.createdAt.toISOString(),
      expense.description ?? expense.category?.name ?? '',
      decimalToNumber(expense.amount),
      expense.status,
      '',
    ]);
  }

  csv += csvRow(['--- PAYMENTS ---']);

  for (const tx of transactions) {
    csv += csvRow([
      tx.type,
      tx.createdAt.toISOString(),
      tx.notes ?? tx.reference ?? '',
      decimalToNumber(tx.amount),
      '',
      tx.paymentMethod ?? '',
    ]);
  }

  const safeName = memberName.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const filename = `statement_${safeName}_${generatedAt.slice(0, 10)}.csv`;

  return { csv, filename, memberName, currency, openBalance: decimalToNumber(openBalance) };
}
