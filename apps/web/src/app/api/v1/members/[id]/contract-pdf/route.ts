import { isAthleteContext } from '@/lib/api/auth-context';
import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { logContractPdfGenerated } from '@/actions/contracts';
import { buildContractPdf } from '@/lib/contract-pdf';

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

  if (!isAthleteContext(context) && !['OWNER', 'ADMIN', 'STAFF'].includes(context.role)) {
    return apiErrorI18n('roleForbidden', 403, request);
  }

  const pdf = await buildContractPdf(context.organizationId, gymMemberId);
  if (!pdf) {
    return apiErrorI18n('memberNotFound', 404, request);
  }

  if (context.scope === 'staff') {
    await logContractPdfGenerated(context.organizationId, context.userId, gymMemberId);
  }

  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
