'use server';

import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@sgms/database';
import { revalidatePath } from 'next/cache';

export type InvoiceIssueInput = {
  gymMemberId: string;
  amount: number;
  currency: string;
  expenseId?: string;
  notes?: string;
  issuedById: string;
  organizationId: string;
  description?: string;
};

async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `INV-${y}${m}${d}`;

  const count = await tx.invoice.count({
    where: {
      organizationId,
      invoiceNumber: { startsWith: prefix },
    },
  });

  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

export async function issueInvoiceFromPayment(
  input: InvoiceIssueInput,
  tx?: Prisma.TransactionClient,
) {
  const run = async (db: Prisma.TransactionClient) => {
    const member = await db.gymMember.findFirst({
      where: { id: input.gymMemberId, organizationId: input.organizationId },
      select: { nationalId: true, passportNumber: true, isForeignMember: true },
    });

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const taxId = member.isForeignMember ? member.passportNumber : member.nationalId;
    const lineDescription =
      input.description?.trim() ||
      input.notes?.trim() ||
      'Salon tahsilatı';
    const now = new Date();
    const invoiceNumber = await generateInvoiceNumber(db, input.organizationId);

    const invoice = await db.invoice.create({
      data: {
        organizationId: input.organizationId,
        gymMemberId: input.gymMemberId,
        totalAmount: input.amount,
        currency: input.currency.toUpperCase(),
        status: 'PAID',
        notes: input.notes ?? null,
        invoiceNumber,
        taxId: taxId ?? null,
        issuedAt: now,
        issuedById: input.issuedById,
        invoiceItems: {
          create: {
            name: lineDescription,
            quantity: 1,
            unitPrice: input.amount,
            lineTotal: input.amount,
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        actorId: input.issuedById,
        organizationId: input.organizationId,
        action: 'INVOICE_ISSUED',
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: {
          gymMemberId: input.gymMemberId,
          amount: input.amount,
          currency: input.currency,
          expenseId: input.expenseId ?? null,
          invoiceNumber,
        },
      },
    });

    return invoice;
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}
