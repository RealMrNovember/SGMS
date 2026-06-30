import { isAthleteContext } from '@/lib/api/auth-context';
import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { buildMemberStatementCsv } from '@/lib/member-statement';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireMemberScopedApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;
  const { id: gymMemberId } = await params;

  if (isAthleteContext(context) && context.gymMemberId !== gymMemberId) {
    return apiErrorI18n('ownRecordsOnly', 403, request);
  }

  const statement = await buildMemberStatementCsv(context.organizationId, gymMemberId);
  if (!statement) {
    return apiErrorI18n('memberNotFound', 404, request);
  }

  return new Response(statement.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${statement.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
