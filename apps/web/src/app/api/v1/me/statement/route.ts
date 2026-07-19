import { requireAthleteApiContext } from '@/lib/api/auth-context';
import { apiOk } from '@/lib/api/response';
import { getMemberAccountSummary } from '@/lib/member-balance';
import { getMemberPaymentPlans } from '@/lib/payment-plans';

export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;

  const [summary, paymentPlans] = await Promise.all([
    getMemberAccountSummary(organizationId, gymMemberId),
    getMemberPaymentPlans(organizationId, gymMemberId),
  ]);

  return apiOk({
    openBalance: summary.openBalance,
    balancesByCurrency: summary.balancesByCurrency,
    recentExpenses: summary.recentExpenses.map((expense) => ({
      id: expense.id,
      description: expense.description,
      category: expense.category?.name ?? null,
      status: expense.status,
      amount: Number(expense.amount.toString()),
      currency: expense.currency,
      createdAt: expense.createdAt,
    })),
    recentTransactions: summary.recentTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount.toString()),
      currency: tx.currency,
      paymentMethod: tx.paymentMethod,
      createdAt: tx.createdAt,
    })),
    paymentPlans: paymentPlans.filter((plan) => plan.status === 'ACTIVE'),
  });
}
