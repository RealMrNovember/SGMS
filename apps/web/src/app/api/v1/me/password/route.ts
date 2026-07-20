import { changeOwnPassword } from '@/actions/athlete-profile';
import { apiError, apiOk } from '@/lib/api/response';

/**
 * Mobil uygulama için Faz 38 — web'deki `changeOwnPassword` server action'ıyla
 * aynı mantığı kullanır (mevcut parola doğrulaması dahil).
 */
export async function POST(request: Request) {
  let body: { currentPassword?: string; newPassword?: string; newPasswordConfirmation?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz istek gövdesi.', 400);
  }

  const form = new FormData();
  form.set('currentPassword', body.currentPassword ?? '');
  form.set('newPassword', body.newPassword ?? '');
  form.set('newPasswordConfirmation', body.newPasswordConfirmation ?? '');

  const result = await changeOwnPassword({}, form, request);
  if (result.error) {
    return apiError(result.error, 400);
  }

  return apiOk({ message: result.success ?? 'Parolanız güncellendi.' });
}
