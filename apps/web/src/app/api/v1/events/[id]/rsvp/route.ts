import { rsvpToGymEvent } from '@/actions/gym-events';
import { apiError, apiOk } from '@/lib/api/response';

/** Sporcu bir etkinliğe katılım bildirir/iptal eder — web ve mobil aynı action'ı kullanır. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { going?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // gövde boş gönderilirse de "katıl" (going=true) kabul edilir.
  }

  const going = body.going !== false;

  const result = await rsvpToGymEvent(id, going, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
