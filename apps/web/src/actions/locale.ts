'use server';

import { routing, type AppLocale } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function setLocale(locale: AppLocale) {
  if (!routing.locales.includes(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { locale },
    });
  }
}
