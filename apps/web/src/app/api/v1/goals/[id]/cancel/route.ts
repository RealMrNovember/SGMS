import { cancelAthleteGoal } from '@/actions/goals';
import { apiError, apiOk } from '@/lib/api/response';

/** Sporcu kendi hedefini iptal eder (bkz. `actions/goals.ts`, aynı mantık web'de de kullanılır). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await cancelAthleteGoal(id, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
