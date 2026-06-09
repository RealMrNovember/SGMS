import { auth } from '@/lib/auth';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { detectLocale } from './detect-locale';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await auth();

  let locale =
    cookieStore.get('NEXT_LOCALE')?.value ??
    session?.user?.locale ??
    detectLocale(headerStore.get('accept-language'));

  if (!hasLocale(routing.locales, locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
