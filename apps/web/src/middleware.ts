import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

function defaultDestination(isSuperAdmin: boolean) {
  return isSuperAdmin ? '/admin' : '/dashboard';
}

export default auth((request) => {
  const isLoggedIn = !!request.auth;
  const isSuperAdmin = request.auth?.user?.isSuperAdmin === true;
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/';

  const isApiV1 = pathname.startsWith('/api/v1');

  if (!isLoggedIn && isApiV1) {
    return NextResponse.json({ ok: false, error: 'Kimlik doğrulama gerekli.' }, { status: 401 });
  }

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL(defaultDestination(isSuperAdmin), request.nextUrl.origin));
  }

  if (isLoggedIn && pathname.startsWith('/admin') && !isSuperAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin));
  }

  if (isLoggedIn && pathname.startsWith('/dashboard') && isSuperAdmin) {
    return NextResponse.redirect(new URL('/admin', request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
