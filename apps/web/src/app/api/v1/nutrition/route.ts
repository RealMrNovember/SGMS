import { createFoodLogEntry } from '@/actions/nutrition';
import { requireAthleteApiContext } from '@/lib/api/guard';
import { apiError, apiOk } from '@/lib/api/response';
import { getNutritionOverviewForMember } from '@/lib/nutrition/list';

/**
 * Faz 41 — mobil "Beslenme". Sporcu kendi öğün günlüğünü, varsa PT'sinin
 * belirlediği günlük hedef kaloriyle (aktif `NUTRITION` programı) birlikte görür.
 */
export async function GET(request: Request) {
  const authResult = await requireAthleteApiContext(request);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { organizationId, gymMemberId } = authResult.context;
  const overview = await getNutritionOverviewForMember(organizationId, gymMemberId);

  return apiOk({
    plannedDailyCalories: overview.plannedDailyCalories,
    activeProgramTitle: overview.activeProgramTitle,
    days: overview.days.map((day) => ({
      dateKey: day.dateKey,
      totalCalories: day.totalCalories,
      totalProteinG: day.totalProteinG,
      totalCarbsG: day.totalCarbsG,
      totalFatG: day.totalFatG,
      entryCount: day.entryCount,
      entries: day.entries.map((entry) => ({
        id: entry.id,
        loggedAt: entry.loggedAt.toISOString(),
        mealType: entry.mealType,
        foodName: entry.foodName,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        notes: entry.notes,
        photoUrl: entry.photoUrl,
      })),
    })),
  });
}

/**
 * Sporcu kendi öğününü kaydeder — web sporcu portalındaki `createFoodLogEntry`
 * server action'ıyla aynı, tek kaynaktan gelen mantığı kullanır.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz istek gövdesi.', 400);
  }

  const input = body as {
    mealType?: unknown;
    foodName?: unknown;
    loggedAt?: unknown;
    calories?: unknown;
    proteinG?: unknown;
    carbsG?: unknown;
    fatG?: unknown;
    notes?: unknown;
  };

  const formData = new FormData();
  formData.set('mealType', typeof input.mealType === 'string' ? input.mealType : '');
  formData.set('foodName', typeof input.foodName === 'string' ? input.foodName : '');
  formData.set('loggedAt', typeof input.loggedAt === 'string' ? input.loggedAt : '');
  formData.set(
    'calories',
    typeof input.calories === 'number' || typeof input.calories === 'string' ? String(input.calories) : '',
  );
  formData.set(
    'proteinG',
    typeof input.proteinG === 'number' || typeof input.proteinG === 'string' ? String(input.proteinG) : '',
  );
  formData.set(
    'carbsG',
    typeof input.carbsG === 'number' || typeof input.carbsG === 'string' ? String(input.carbsG) : '',
  );
  formData.set('fatG', typeof input.fatG === 'number' || typeof input.fatG === 'string' ? String(input.fatG) : '');
  formData.set('notes', typeof input.notes === 'string' ? input.notes : '');

  const result = await createFoodLogEntry({}, formData, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
