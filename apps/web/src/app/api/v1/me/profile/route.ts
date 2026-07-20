import { updateOwnContactInfo, updateOwnDisplayName } from '@/actions/athlete-profile';
import { apiError, apiOk } from '@/lib/api/response';

/**
 * Mobil uygulama (SGMS Sporcu) için Faz 38 — web'deki
 * `updateOwnDisplayName`/`updateOwnContactInfo` server action'larıyla aynı,
 * tek kaynaktan gelen mantığı kullanır (`actions/athlete-profile.ts`,
 * Bearer token da kabul edecek şekilde genişletildi). Gövdedeki hangi alanlar
 * doluysa yalnızca onlar güncellenir.
 */
export async function PATCH(request: Request) {
  let body: { name?: string; phone?: string; email?: string; birthDate?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Geçersiz istek gövdesi.', 400);
  }

  const results: string[] = [];

  if (typeof body.name === 'string' && body.name.trim()) {
    const nameForm = new FormData();
    nameForm.set('name', body.name);
    const result = await updateOwnDisplayName({}, nameForm, request);
    if (result.error) {
      return apiError(result.error, 400);
    }
    if (result.success) results.push(result.success);
  }

  if (body.phone !== undefined || body.email !== undefined || body.birthDate !== undefined) {
    const contactForm = new FormData();
    if (body.phone !== undefined) contactForm.set('phone', body.phone);
    if (body.email !== undefined) contactForm.set('email', body.email);
    if (body.birthDate !== undefined) contactForm.set('birthDate', body.birthDate);
    const result = await updateOwnContactInfo({}, contactForm, request);
    if (result.error) {
      return apiError(result.error, 400);
    }
    if (result.success) results.push(result.success);
  }

  if (results.length === 0) {
    return apiError('Güncellenecek bir alan gönderilmedi.', 400);
  }

  return apiOk({ message: results.join(' ') });
}
