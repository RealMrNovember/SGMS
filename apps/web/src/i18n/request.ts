import { auth } from '@/lib/auth';
import { resolveUserLocaleChain } from '@/lib/org-locale';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await auth();

  let locale = await resolveUserLocaleChain({
    cookieLocale: cookieStore.get('NEXT_LOCALE')?.value,
    sessionLocale: session?.user?.locale,
    organizationId: session?.user?.organizationId,
    acceptLanguage: headerStore.get('accept-language'),
  });

  if (!hasLocale(routing.locales, locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
