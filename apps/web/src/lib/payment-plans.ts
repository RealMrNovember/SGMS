import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/member-balance';

export async function getMemberPaymentPlans(organizationId: string, gymMemberId: string) {
  const plans = await prisma.paymentPlan.findMany({
    where: { organizationId, gymMemberId },
    orderBy: { createdAt: 'desc' },
    include: {
      expenses: {
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          description: true,
        },
      },
    },
  });

  return plans.map((plan) => ({
    id: plan.id,
    description: plan.description,
    installmentCount: plan.installmentCount,
    status: plan.status,
    installments: plan.expenses.map((expense) => ({
      id: expense.id,
      amount: decimalToNumber(expense.amount),
      paidAmount: decimalToNumber(expense.paidAmount),
      status: expense.status,
      dueDate: expense.dueDate,
      description: expense.description,
    })),
  }));
}

export async function getOrganizationPaymentPlansOverview(organizationId: string) {
  const installments = await prisma.expense.findMany({
    where: {
      organizationId,
      paymentPlanId: { not: null },
      status: 'OPEN',
    },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
    include: {
      gymMember: { select: { id: true, firstName: true, lastName: true } },
      paymentPlan: { select: { id: true, installmentCount: true } },
    },
  });

  return installments.map((expense) => ({
    id: expense.id,
    gymMemberId: expense.gymMember.id,
    memberName: `${expense.gymMember.firstName} ${expense.gymMember.lastName}`,
    planId: expense.paymentPlan?.id ?? null,
    installmentCount: expense.paymentPlan?.installmentCount ?? 1,
    amount: decimalToNumber(expense.amount),
    paidAmount: decimalToNumber(expense.paidAmount),
    dueDate: expense.dueDate,
    description: expense.description,
  }));
}

export async function getOverdueInstallmentCount(organizationId: string, now = new Date()) {
  return prisma.expense.count({
    where: {
      organizationId,
      status: 'OPEN',
      paymentPlanId: { not: null },
      dueDate: { lt: now },
    },
  });
}
