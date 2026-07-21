import { deleteFoodLogEntry } from '@/actions/nutrition';
import { apiError, apiOk } from '@/lib/api/response';

type RouteParams = { params: Promise<{ id: string }> };

/** Sporcu kendi yanlış girdiği bir öğün kaydını siler (mobil "Beslenme" ekranı). */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const result = await deleteFoodLogEntry(id, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success });
}
