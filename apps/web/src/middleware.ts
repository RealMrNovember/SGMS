import { detectAutoLocale } from '@/i18n/detect-locale';
import { authConfig } from '@/lib/auth.config';
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const { auth } = NextAuth(authConfig);

const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

function withLocaleCookie(request: NextRequest, response: NextResponse) {
  if (!request.cookies.get(LOCALE_COOKIE)) {
    const locale = detectAutoLocale({
      country: request.headers.get('cf-ipcountry'),
      acceptLanguage: request.headers.get('accept-language'),
    });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: LOCALE_MAX_AGE,
      sameSite: 'lax',
    });
  }

  return response;
}

function defaultDestination(isSuperAdmin: boolean, isAthlete: boolean) {
  if (isSuperAdmin) {
    return '/admin';
  }
  if (isAthlete) {
    return '/athlete';
  }
  return '/dashboard';
}

function isAthleteSession(auth: { user?: { gymMemberId?: string | null; role?: string | null } } | null) {
  return Boolean(auth?.user?.gymMemberId && auth.user.role === 'VIEWER');
}

export default auth((request) => {
  const isLoggedIn = !!request.auth;
  const isSuperAdmin = request.auth?.user?.isSuperAdmin === true;
  const isAthlete = isAthleteSession(request.auth);
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/trial') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/';

  const isApiV1 = pathname.startsWith('/api/v1');
  const isApi = pathname.startsWith('/api');

  if (!isLoggedIn && isApiV1) {
    return NextResponse.json({ ok: false, error: 'Kimlik doğrulama gerekli.' }, { status: 401 });
  }

  if (!isLoggedIn && !isPublic && !isApi) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return withLocaleCookie(request, NextResponse.redirect(loginUrl));
  }

  if (isLoggedIn && pathname === '/login') {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL(defaultDestination(isSuperAdmin, isAthlete), request.nextUrl.origin)),
    );
  }

  if (isLoggedIn && pathname.startsWith('/dashboard') && isAthlete) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL('/athlete', request.nextUrl.origin)),
    );
  }

  if (isLoggedIn && pathname.startsWith('/athlete') && !request.auth?.user?.gymMemberId) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin)),
    );
  }

  if (isLoggedIn && pathname.startsWith('/admin') && !isSuperAdmin) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin)),
    );
  }

  if (isLoggedIn && pathname.startsWith('/dashboard') && isSuperAdmin) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL('/admin', request.nextUrl.origin)),
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  return withLocaleCookie(
    request,
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
  );
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
