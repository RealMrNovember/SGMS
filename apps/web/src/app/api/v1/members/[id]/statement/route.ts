import { isAthleteContext } from '@/lib/api/auth-context';
import { requireMemberScopedApiContext } from '@/lib/api/guard';
import { apiErrorI18n } from '@/lib/api/i18n-errors';
import { buildMemberStatementCsv, loadMemberStatementData } from '@/lib/member-statement';
import { buildMemberStatementPdf } from '@/lib/member-statement-pdf';
import { intlLocaleFor } from '@/lib/format-locale';

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

  // Cari ekstre finansal veridir — TRAINER hiçbir üyenin ekstresini göremez (bkz. roadmap.md Faz 36.5).
  if (!isAthleteContext(context) && context.role === 'TRAINER') {
    return apiErrorI18n('roleForbidden', 403, request);
  }

  const format = new URL(request.url).searchParams.get('format')?.toLowerCase();

  if (format === 'pdf') {
    const data = await loadMemberStatementData(context.organizationId, gymMemberId);
    if (!data) {
      return apiErrorI18n('memberNotFound', 404, request);
    }

    const acceptLanguage = request.headers.get('accept-language') ?? 'tr';
    const locale = intlLocaleFor(acceptLanguage.split(',')[0]?.trim() || 'tr');
    const pdf = await buildMemberStatementPdf(data, locale);

    return new Response(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdf.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
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
