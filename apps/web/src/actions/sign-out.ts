'use server';

import { signOut } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * next-auth@5 beta sürümünde, bir Server Action içinden çağrılan signOut()'un
 * yönlendirmeyle birleştiği durumlarda oturum çerezini temizlemesi bazı reverse-proxy
 * kurulumlarında güvenilir olmuyor — kullanıcı çıkış yapıp sayfayı yenilediğinde
 * tekrar giriş yapılmış görünebiliyor. Bilinen tüm NextAuth çerez adlarını (güvenli/
 * güvensiz varyantlarıyla) elle temizleyerek bu riski ortadan kaldırıyoruz; signOut()
 * sonrasında hâlâ çağrılıyor çünkü audit log (USER_LOGOUT) ve resmi redirect akışı için gerekli.
 */
const KNOWN_AUTH_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  // next-auth v4 uyumluluğu / eski dağıtımlardan kalmış olabilecek adlar
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
];

export async function performSignOut(redirectTo: string) {
  const cookieStore = await cookies();
  for (const name of KNOWN_AUTH_COOKIE_NAMES) {
    cookieStore.delete(name);
  }

  await signOut({ redirectTo });
}
