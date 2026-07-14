import { auth } from '@/lib/auth';

/**
 * Master Admin gerektiren server action'ların ortak girişi.
 * Demo hesaplar (login sayfasındaki tek tıkla giriş) isSuperAdmin=true olsa bile
 * hiçbir mutasyona izin verilmez — yalnızca paneli incelemek için var.
 */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Bu işlem için Master Admin yetkisi gerekir.');
  }
  if (session.user.isDemo) {
    throw new Error('Demo hesaplar değişiklik yapamaz. Bu bir inceleme hesabıdır — gerçek kullanım için ücretsiz deneme oluşturun.');
  }
  return session;
}
