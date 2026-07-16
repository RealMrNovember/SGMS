'use server';

import { cookies } from 'next/headers';

export type AppTheme = 'dark' | 'light';

export async function setTheme(theme: AppTheme) {
  if (theme !== 'dark' && theme !== 'light') {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
