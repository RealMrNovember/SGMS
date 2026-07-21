import { createOwnAthleteGoal } from '@/actions/goals';
import { requireAthleteApiContext } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { listAthleteGoalsWithProgress } from '@/lib/goals/list';

/**
 * Faz 39 — mobil "Hedeflerim". Sporcu kendi hedeflerini (PT tarafından
 * atanmış veya kendi koyduğu) canlı hesaplanmış ilerleme yüzdesiyle görür.
 */
export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;
  const goals = await listAthleteGoalsWithProgress(organizationId, gymMemberId);

  return apiOk({
    goals: goals.map((goal) => ({
      id: goal.id,
      createdByType: goal.createdByType,
      targetType: goal.targetType,
      measurementField: goal.measurementField,
      direction: goal.direction,
      targetValue: goal.targetValue?.toString() ?? null,
      startValue: goal.startValue?.toString() ?? null,
      targetDate: goal.targetDate?.toISOString() ?? null,
      status: goal.status,
      notes: goal.notes,
      achievedAt: goal.achievedAt?.toISOString() ?? null,
      createdAt: goal.createdAt.toISOString(),
      progressPercent: goal.progress.progressPercent,
      currentValue: goal.progress.currentValue,
    })),
  });
}

/**
 * Sporcu kendi hedefini oluşturur — PT'si olmasa bile (bkz. roadmap.md Faz 39).
 * Web'deki `createOwnAthleteGoal` server action'ıyla aynı, tek kaynaktan gelen
 * mantığı kullanır (`request` verilince Bearer token da kabul edilir).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz istek gövdesi.', 400);
  }

  const input = body as {
    targetType?: unknown;
    measurementField?: unknown;
    direction?: unknown;
    targetValue?: unknown;
    targetDate?: unknown;
    notes?: unknown;
  };

  const formData = new FormData();
  formData.set('targetType', typeof input.targetType === 'string' ? input.targetType : '');
  formData.set('measurementField', typeof input.measurementField === 'string' ? input.measurementField : '');
  formData.set('direction', typeof input.direction === 'string' ? input.direction : '');
  formData.set(
    'targetValue',
    typeof input.targetValue === 'number' || typeof input.targetValue === 'string'
      ? String(input.targetValue)
      : '',
  );
  formData.set('targetDate', typeof input.targetDate === 'string' ? input.targetDate : '');
  formData.set('notes', typeof input.notes === 'string' ? input.notes : '');

  const result = await createOwnAthleteGoal({}, formData, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
